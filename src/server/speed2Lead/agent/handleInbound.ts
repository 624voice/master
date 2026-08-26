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
} from "~/server/speed2Lead/agent/state";
import { runAgentTurn, type AgentTurnOutput } from "~/server/speed2Lead/agent/llmTurn";
import { confirmBookSlot, offerSlots } from "~/server/speed2Lead/agent/scheduling";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

/**
 * Decide, deterministically, whether this turn should look up real calendar
 * availability before calling the LLM. We prefetch when the previous turn
 * already asked the meeting-bridge question (so a "yes" this turn can be
 * answered with real times immediately) or when we're already mid-offer.
 */
async function slotsForThisTurn(session: AgentSession) {
  const profile = getActiveProfile();
  if (session.stage === "bridge") {
    const fetched = await offerSlots(profile);
    return fetched.ok ? fetched.slots : [];
  }
  if (session.stage === "offering_slots" || session.stage === "confirming") {
    return session.offeredSlots;
  }
  return [];
}

export async function handleAgentInboundSms(fromPhoneRaw: string, body: string): Promise<void> {
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

  session = appendMessage(session, "user", body);

  const offered = await slotsForThisTurn(session);

  let output: AgentTurnOutput;
  try {
    output = await runAgentTurn(getActiveProfile(), session, offered);
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
      // The appointment lifecycle (inside confirmBookSlot -> bookConsultation)
      // already sends the confirmation SMS with the real Google Meet link and
      // reminder scheduling — do not send a second message here.
      session.stage = "booked";
      session.bookedStartIso = booked.startIso;
      session.bookedEventId = booked.eventId;
      session.offeredSlots = [];
      session = appendMessage(session, "assistant", `[booked ${booked.startIso}]`);
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
