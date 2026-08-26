/**
 * Webhook entrypoint for the rebuilt Speed2Lead agent (ROI-report flow only).
 *
 * Deterministic responsibilities live here: opt-out handling, deciding when
 * to fetch real slots, executing a confirmed booking, and persisting state.
 * Everything about what to SAY is delegated to the single LLM call in
 * `llmTurn.ts`.
 */
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  appendMessage,
  getAgentSession,
  isOptedOut,
  saveAgentSession,
  setOptedOut,
  type AgentSession,
  type OfferedSlot,
} from "~/server/speed2Lead/agent/state";
import { runAgentTurn, type AgentTurnOutput, type TurnContext } from "~/server/speed2Lead/agent/llmTurn";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import { confirmBookSlot, offerSlots } from "~/server/speed2Lead/agent/scheduling";
import { formatNaturalAppointmentParts } from "~/server/appointmentLifecycle/formatTime";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

type SlotsForTurnResult = {
  slots: OfferedSlot[];
  fetchFailed: boolean;
};

/**
 * Decide, deterministically, whether this turn should look up real calendar
 * availability before calling the LLM. We prefetch when the previous turn
 * already asked the meeting-bridge question (so a "yes" this turn can be
 * answered with real times immediately) or when we're already mid-offer.
 */
async function slotsForThisTurn(session: AgentSession): Promise<SlotsForTurnResult> {
  const profile = getActiveProfile();
  if (session.stage === "bridge") {
    const fetched = await offerSlots(profile);
    return fetched.ok
      ? { slots: fetched.slots, fetchFailed: false }
      : { slots: [], fetchFailed: true };
  }
  if (session.stage === "offering_slots" || session.stage === "confirming") {
    return { slots: session.offeredSlots, fetchFailed: false };
  }
  return { slots: [], fetchFailed: false };
}

export async function handleAgentInboundSms(
  fromPhoneRaw: string,
  body: string,
  messageSid?: string,
): Promise<void> {
  const phone = normalizePhone(fromPhoneRaw);

  if (isStopKeyword(body)) {
    await setOptedOut(phone);
    return; // Twilio/carrier sends the compliance confirmation; don't double-text.
  }

  if (await isOptedOut(phone)) {
    return;
  }

  let session = await getAgentSession(phone);
  if (!session) {
    // No active ROI-report session for this number — nothing to do. (The
    // contact/demo flows are untouched and continue to run separately.)
    return;
  }

  // A Twilio webhook retry (or genuine duplicate delivery) of a message we
  // already processed must be a no-op — otherwise it double-sends a reply
  // and can double-book. Twilio always includes a MessageSid; compare it to
  // the last one we actually acted on for this phone.
  if (messageSid && session.lastInboundMessageSid === messageSid) {
    return;
  }

  session = appendMessage(session, "user", body);
  session.lastInboundMessageSid = messageSid;
  // The prospect engaged before the scheduled second opener message went
  // out — cancel it rather than asking a question they've already answered.
  session = await cancelPendingPainPrompt(session);

  const { slots: offered, fetchFailed } = await slotsForThisTurn(session);
  const turnContext: TurnContext = { slotsUnavailable: fetchFailed };

  let output: AgentTurnOutput;
  try {
    output = await runAgentTurn(getActiveProfile(), session, offered, turnContext);
  } catch (error) {
    console.error("Speed2Lead agent turn failed:", error);
    const fallback =
      "Sorry, hit a snag on my end — mind resending that? If it keeps happening, just let me know and I'll call you directly.";
    await sendSms(phone, fallback);
    session = appendMessage(session, "assistant", fallback);
    await saveAgentSession(session);
    return;
  }

  if (output.opt_out) {
    await setOptedOut(phone);
    session.stage = "declined";
    await saveAgentSession(session);
    return;
  }

  const chosenSlot =
    output.slot_choice_index != null ? offered[output.slot_choice_index] : undefined;

  if (output.confirm_booking && chosenSlot) {
    const booked = await confirmBookSlot({
      slot: chosenSlot,
      phone,
      attendeeName: session.firstName ?? "there",
      attendeeEmail: session.email,
      businessName: session.businessName,
    });

    if (booked.ok) {
      session.stage = "booked";
      session.bookedStartIso = booked.startIso;
      session.bookedEventId = booked.eventId;
      session.offeredSlots = [];

      if (booked.confirmationSmsSent) {
        // Lifecycle sent the Meet-link confirmation and scheduled reminders.
        session = appendMessage(session, "assistant", `[booked ${booked.startIso}]`);
        await saveAgentSession(session);
        return;
      }

      // Idempotent replay (or other lifecycle skip): still tell the prospect
      // they're booked — silence here was the original silent-turn bug.
      const parts = formatNaturalAppointmentParts(
        booked.startIso,
        getActiveProfile().timezone,
      );
      const tz = parts.timezoneShort ? ` ${parts.timezoneShort}` : "";
      const alreadyBooked = `You're already booked for ${parts.weekday}, ${parts.month} ${parts.day} at ${parts.time}${tz}.`;
      await sendSms(phone, alreadyBooked);
      session = appendMessage(session, "assistant", alreadyBooked);
      await saveAgentSession(session);
      return;
    }

    // Booking failed (e.g. someone else took the slot in the meantime) —
    // fall through and let the model's reply carry an apology + next step,
    // but refresh the offered list so we don't keep offering a dead slot.
    const refreshed = await offerSlots(getActiveProfile());
    session.offeredSlots = refreshed.ok ? refreshed.slots : [];
    session.stage = "offering_slots";
    const text = output.reply || "That time just got taken — want me to grab you another?";
    await sendSms(phone, text);
    session = appendMessage(session, "assistant", text);
    await saveAgentSession(session);
    return;
  }

  // Normal turn: trust the model's stage/pain tracking, but never let it
  // regress out of a terminal state once reached.
  if (session.stage !== "booked" && session.stage !== "declined") {
    session.stage = output.stage;
  }
  if (output.primary_pain) {
    session.primaryPain = output.primary_pain;
  }
  if (offered.length > 0 && (output.stage === "offering_slots" || output.stage === "confirming")) {
    session.offeredSlots = offered;
  }

  await sendSms(phone, output.reply);
  session = appendMessage(session, "assistant", output.reply);
  await saveAgentSession(session);
}
