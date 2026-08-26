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
  acquireAgentInboundLock,
  appendMessage,
  claimAgentOutboundForInbound,
  claimInboundMessageSid,
  getAgentSession,
  isOptedOut,
  releaseAgentInboundLock,
  saveAgentSession,
  setOptedOut,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { runAgentTurn, type AgentTurnOutput, type TurnContext } from "~/server/speed2Lead/agent/llmTurn";
import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import {
  resolveSlotsForAgentTurn,
  validateConfirmBooking,
} from "~/server/speed2Lead/agent/slotPreferences";
import { confirmBookSlot, offerSlots } from "~/server/speed2Lead/agent/scheduling";
import {
  buildPainClarifyingReply,
  containsPainHint,
  isAmbiguousDiscoveryReply,
  isMeetingDecline,
  isMeetingDeclineStage,
  sessionAwaitingPainAnswer,
} from "~/server/speed2Lead/agent/turnGuards";
import { formatNaturalAppointmentParts } from "~/server/appointmentLifecycle/formatTime";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

async function cancelPendingScheduledOutreach(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelPendingPainPrompt(session);
  updated = await cancelPendingNoResponseCampaign(updated);
  return updated;
}

async function sendAgentReplySms(
  phone: string,
  body: string,
  messageSid: string | undefined,
): Promise<boolean> {
  if (!(await claimAgentOutboundForInbound(messageSid))) {
    console.warn("handleAgentInboundSms skipped duplicate outbound", {
      phoneSuffix: phone.slice(-4),
      messageSid,
    });
    return false;
  }
  await sendSms(phone, body);
  return true;
}

export async function handleAgentInboundSms(
  fromPhoneRaw: string,
  body: string,
  messageSid?: string,
): Promise<void> {
  const phone = normalizePhone(fromPhoneRaw);

  if (isStopKeyword(body)) {
    await setOptedOut(phone);
    const stopSession = await getAgentSession(phone);
    if (stopSession) {
      const updated = await cancelPendingScheduledOutreach(stopSession);
      await saveAgentSession(updated);
    }
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

  const lockToken = await acquireAgentInboundLock(phone);
  if (!lockToken) {
    return;
  }

  try {
    session = await getAgentSession(phone);
    if (!session) {
      return;
    }
    if (messageSid && session.lastInboundMessageSid === messageSid) {
      return;
    }
    if (messageSid && !(await claimInboundMessageSid(messageSid, phone))) {
      return;
    }

    session = appendMessage(session, "user", body);
    session.lastInboundMessageSid = messageSid;
    // The prospect engaged before the scheduled second opener message went
    // out — cancel it rather than asking a question they've already answered.
    session = await cancelPendingScheduledOutreach(session);

    const profile = getActiveProfile();
    const ambiguousPainReply =
      sessionAwaitingPainAnswer(session) &&
      isAmbiguousDiscoveryReply(body) &&
      !containsPainHint(body, profile);

    if (ambiguousPainReply) {
      const reply = buildPainClarifyingReply(profile);
      await sendAgentReplySms(phone, reply, messageSid);
      session = appendMessage(session, "assistant", reply);
      await saveAgentSession(session);
      return;
    }

    const declineThisTurn = isMeetingDecline(body) && isMeetingDeclineStage(session.stage);
    if (declineThisTurn) {
      session.meetingDeclineCount = (session.meetingDeclineCount ?? 0) + 1;
    }

    const slotResolution = await resolveSlotsForAgentTurn(session, body, profile);
    session = slotResolution.session;
    const offered = slotResolution.slots;
    const turnContext: TurnContext = { slotsUnavailable: slotResolution.fetchFailed };

    let output: AgentTurnOutput;
    try {
      output = await runAgentTurn(profile, session, offered, turnContext);
    } catch (error) {
      console.error("Speed2Lead agent turn failed:", error);
      const fallback =
        "Sorry, hit a snag on my end — mind resending that? If it keeps happening, just let me know and I'll call you directly.";
      await sendAgentReplySms(phone, fallback, messageSid);
      session = appendMessage(session, "assistant", fallback);
      await saveAgentSession(session);
      return;
    }

    if (output.opt_out) {
      await setOptedOut(phone);
      session.stage = "declined";
      session = await cancelPendingNoResponseCampaign(session);
      await saveAgentSession(session);
      return;
    }

    const bookingValidation = validateConfirmBooking({
      body,
      session,
      offered,
      slotChoiceIndex: output.slot_choice_index,
      confirmBooking: output.confirm_booking,
    });

    if (output.confirm_booking && !bookingValidation.proceed) {
      console.warn("Speed2Lead agent rejected premature confirm_booking", {
        phoneSuffix: phone.slice(-4),
        reason: bookingValidation.logReason,
        inbound: body.slice(0, 80),
        slotChoiceIndex: output.slot_choice_index,
        offeredCount: offered.length,
      });
      output = { ...output, confirm_booking: false, slot_choice_index: null };
    }

    const chosenSlot = bookingValidation.proceed ? bookingValidation.slot : undefined;

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
        session.slotPool = [];
        session = await cancelPendingNoResponseCampaign(session);

        if (booked.confirmationSmsSent) {
          // Lifecycle sent the Meet-link confirmation and scheduled reminders.
          session = appendMessage(session, "assistant", `[booked ${booked.startIso}]`);
          await saveAgentSession(session);
          return;
        }

        // Idempotent replay (or other lifecycle skip): still tell the prospect
        // they're booked — silence here was the original silent-turn bug.
        const parts = formatNaturalAppointmentParts(booked.startIso, profile.timezone);
        const tz = parts.timezoneShort ? ` ${parts.timezoneShort}` : "";
        const alreadyBooked = `You're already booked for ${parts.weekday}, ${parts.month} ${parts.day} at ${parts.time}${tz}.`;
        await sendAgentReplySms(phone, alreadyBooked, messageSid);
        session = appendMessage(session, "assistant", alreadyBooked);
        await saveAgentSession(session);
        return;
      }

      // Booking failed (e.g. someone else took the slot in the meantime) —
      // fall through and let the model's reply carry an apology + next step,
      // but refresh the offered list so we don't keep offering a dead slot.
      const refreshed = await offerSlots(profile);
      session.offeredSlots = refreshed.ok ? refreshed.slots : [];
      session.slotPool = refreshed.ok ? refreshed.slots : [];
      session.stage = "offering_slots";
      const text = output.reply || "That time just got taken — want me to grab you another?";
      await sendAgentReplySms(phone, text, messageSid);
      session = appendMessage(session, "assistant", text);
      await saveAgentSession(session);
      return;
    }

    // Normal turn: trust the model's stage/pain tracking, but never let it
    // regress out of a terminal state once reached.
    if (session.stage !== "booked" && session.stage !== "declined") {
      session.stage = output.stage;
    }
    if (output.primary_pain && !ambiguousPainReply) {
      session.primaryPain = output.primary_pain;
    }
    if (output.wants_meeting && !declineThisTurn) {
      session.meetingDeclineCount = 0;
    }

    const declineCount = session.meetingDeclineCount ?? 0;
    if (declineCount >= 2) {
      session.stage = "declined";
    } else if (declineCount === 1) {
      // One overcome allowed — never terminal on the first decline.
      session.stage =
        session.stage === "offering_slots" || session.stage === "confirming"
          ? session.stage
          : "bridge";
    }

    if (offered.length > 0) {
      session.offeredSlots = offered;
    }
    if (slotResolution.pool.length > 0) {
      session.slotPool = slotResolution.pool;
    }

    await sendAgentReplySms(phone, output.reply, messageSid);
    session = appendMessage(session, "assistant", output.reply);
    await saveAgentSession(session);
  } finally {
    await releaseAgentInboundLock(phone, lockToken);
  }
}
