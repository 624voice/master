/**
 * Meeting-intent ownership for booking-link handoff.
 * 4a transition and 4b resend are separate evaluators. The LLM never books.
 */
import { getLeadsByPhone, saveLeadIndex } from "~/server/appointmentLifecycle/store";
import { getActiveLifecycleForPhone } from "~/server/appointmentLifecycle/store";
import { processCalendarEvent } from "~/server/appointmentLifecycle/processEvent";
import { tryFetchCalendarEventsUpdatedSince } from "~/server/appointmentLifecycle/googleCalendar";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { isDirectMeetingIntent, isMeetingAgreeIntent } from "~/server/speed2Lead/agent/contactFlow/intentDetect";
import {
  bookingLinkHandoffCopy,
  bookingLinkResendCopy,
  bookingLinkUrl,
} from "~/server/speed2Lead/agent/bookingLinkCopy";
import { enterBooked, enterBookingLinkPending } from "~/server/speed2Lead/agent/bookingLinkFollowUps";
import { persistHumanFollowUp } from "~/server/speed2Lead/agent/humanFollowUp";
import { sendHumanAlert } from "~/server/speed2Lead/agent/humanAlert";
import {
  appendMessage,
  getAgentSession,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { getRedis } from "~/server/speed2Lead/redis";
import { outboundWasAccepted, sendSmsWithState, sendStateKeys } from "~/server/sms/sendState";
import { sendSms } from "~/server/sms/twilio";

const BRIDGE_AGREEMENT_RE =
  /^(yes|yeah|yep|yup|sure|ok(?:ay)?|sounds good)([.!]?)$/i;

const RESEND_RE =
  /\b(send (it |the link )?again|resend|another link|link again|send (me )?the link)\b/i;

const EXPLICIT_HUMAN_RE =
  /\b(talk to (a )?(real )?(human|person)|speak (to|with) (a )?(human|person|someone|chris)|can i talk to (chris|a person|someone)|have (a )?(human|person|chris) (call|text|help))\b/i;

const MANUAL_BOOKING_RE =
  /\b(can'?t (use|open|click) (the )?link|link (doesn'?t|won'?t) work|book it for me|just book (it|me)|schedule it for me)\b/i;

const OUT_OF_BAND_RE =
  /\b(email me (the )?(contract|proposal|quote)|come (by|to) (my|the) (shop|office)|meet in person|call (a )?different number)\b/i;

const SYNC_FAIL_KEY_PREFIX = "speed2lead:agent:booking-link-sync-fail:";

function isAppropriateMeetingIntentStage(stage: AgentSession["stage"]): boolean {
  return stage === "discovery" || stage === "bridge" || stage === "offering_slots" || stage === "confirming";
}

export function isBridgeAgreement(text: string): boolean {
  const trimmed = text.trim();
  if (isDirectMeetingIntent(trimmed)) return true;
  if (isMeetingAgreeIntent(trimmed)) return true;
  return BRIDGE_AGREEMENT_RE.test(trimmed);
}

export function isBookingLinkResendRequest(text: string): boolean {
  return RESEND_RE.test(text.trim()) || isDirectMeetingIntent(text);
}

export function isExplicitHumanRequest(text: string): boolean {
  return EXPLICIT_HUMAN_RE.test(text.trim().toLowerCase());
}

export function isManualBookingRequest(text: string): boolean {
  return MANUAL_BOOKING_RE.test(text.trim().toLowerCase());
}

export function isOutOfBandRequest(text: string): boolean {
  return OUT_OF_BAND_RE.test(text.trim().toLowerCase());
}

/** 4a — fires ONLY when not already booking_link_pending. */
export function shouldTransitionToBookingLink(session: AgentSession, body: string): boolean {
  if (session.stage === "booking_link_pending" || session.stage === "booked" || session.stage === "handoff") {
    return false;
  }
  if (session.stage === "declined") {
    return false;
  }
  if (isDirectMeetingIntent(body) && isAppropriateMeetingIntentStage(session.stage)) {
    return true;
  }
  if (session.stage === "bridge" && session.bridgeDeliveredAt && isBridgeAgreement(body)) {
    return true;
  }
  return false;
}

/** 4b — fires ONLY when already booking_link_pending. */
export function shouldResendBookingLink(session: AgentSession, body: string): boolean {
  if (session.stage !== "booking_link_pending") {
    return false;
  }
  return isBookingLinkResendRequest(body);
}

export async function updateLeadBookingLinkSentAt(
  session: AgentSession,
  timestamp: string,
): Promise<void> {
  const leads = await getLeadsByPhone(session.phone);
  const target = leads.find(
    (l) => l.source === session.flow && l.registeredAt === session.leadRegisteredAt,
  );
  if (!target) {
    logAppointmentEvent("lead_index_target_not_found", {
      phone: session.phone,
      flow: session.flow,
    });
    return;
  }
  await saveLeadIndex({ ...target, bookingLinkSentAt: timestamp });
}

async function syncFailCount(phone: string): Promise<number> {
  const redis = getRedis();
  const raw = await redis.get<number>(`${SYNC_FAIL_KEY_PREFIX}${phone}`);
  return typeof raw === "number" ? raw : 0;
}

async function recordSyncFailure(phone: string): Promise<number> {
  const redis = getRedis();
  const next = (await syncFailCount(phone)) + 1;
  await redis.set(`${SYNC_FAIL_KEY_PREFIX}${phone}`, next, { ex: 60 * 60 * 24 });
  return next;
}

async function clearSyncFailures(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${SYNC_FAIL_KEY_PREFIX}${phone}`);
}

export async function freshPreSendBookingCheck(session: AgentSession): Promise<{
  alreadyBooked: boolean;
  session: AgentSession;
}> {
  if (!session.bookingLinkSentAt) {
    const active = await getActiveLifecycleForPhone(session.phone);
    if (active) {
      const booked = await enterBooked(session);
      return { alreadyBooked: true, session: booked };
    }
    return { alreadyBooked: false, session };
  }

  const syncSince = new Date(new Date(session.bookingLinkSentAt).getTime() - 60 * 60 * 1000).toISOString();
  try {
    const fetched = await tryFetchCalendarEventsUpdatedSince(syncSince);
    if (!fetched.ok) {
      throw new Error("calendar_sync_failed");
    }
    await clearSyncFailures(session.phone);
    for (const event of fetched.events) {
      await processCalendarEvent(event);
    }
  } catch {
    logAppointmentEvent("booking_link_check_sync_failed", { phone: session.phone });
    const failures = await recordSyncFailure(session.phone);
    if (failures >= 3) {
      const escalated = await persistHumanFollowUp(session, "provider_failure_exhausted");
      await sendHumanAlert({
        reason: "provider_failure_exhausted",
        subjectId: session.phone,
        body: `S2L provider_failure_exhausted for ${session.phone} — calendar sync failed 3 times before sending a booking link.`,
      });
      return { alreadyBooked: false, session: escalated };
    }
  }

  const redisSession = await getAgentSession(session.phone);
  const active = await getActiveLifecycleForPhone(session.phone);
  if (active) {
    const base =
      redisSession?.stage === "booked" || redisSession?.stage === "handoff"
        ? redisSession
        : session;
    return { alreadyBooked: true, session: await enterBooked(base) };
  }
  if (redisSession?.stage === "booked") {
    return { alreadyBooked: true, session: redisSession };
  }
  if (redisSession?.stage === "handoff") {
    return { alreadyBooked: false, session: redisSession };
  }
  // Keep the in-memory transition (booking_link_pending + timestamps).
  // Redis still has the pre-transition session and must not clobber it.
  return { alreadyBooked: false, session };
}

export async function executeBookingLinkTransition(
  session: AgentSession,
  messageSid?: string,
): Promise<AgentSession> {
  const now = new Date().toISOString();
  const firstSend = !session.bookingLinkSentAt;
  let next: AgentSession = {
    ...session,
    stage: "booking_link_pending",
    bookingLinkSentAt: session.bookingLinkSentAt ?? now,
    bookingLinkLastSentAt: now,
  };

  logAppointmentEvent("meeting_intent_confirmed", { phone: session.phone, flow: session.flow });

  const check = await freshPreSendBookingCheck(next);
  next = check.session;
  if (check.alreadyBooked || next.stage === "handoff") {
    await saveAgentSession(next);
    return next;
  }

  const link = bookingLinkUrl();
  const body = bookingLinkHandoffCopy(next.flow, link);
  const sendResult = await sendSmsWithState({
    key: sendStateKeys.bookingLinkInitial(next.phone, next.createdAt),
    to: next.phone,
    body,
  });
  if (
    sendResult.outcome === "failed_retryable" ||
    sendResult.outcome === "skipped_in_progress" ||
    sendResult.outcome === "failed_terminal"
  ) {
    return session;
  }
  if (sendResult.outcome === "sent") {
    next = appendMessage(next, "assistant", body);
  }
  next = await enterBookingLinkPending(next);
  if (firstSend && outboundWasAccepted(sendResult)) {
    await updateLeadBookingLinkSentAt(next, next.bookingLinkSentAt ?? now);
  }
  await saveAgentSession(next);
  if (sendResult.outcome === "sent") {
    logAppointmentEvent("booking_link_sent", { phone: next.phone, flow: next.flow });
  }
  void messageSid;
  return next;
}

export async function executeBookingLinkResend(
  session: AgentSession,
  messageSid?: string,
): Promise<AgentSession> {
  const now = new Date().toISOString();
  const check = await freshPreSendBookingCheck(session);
  let next = check.session;
  if (check.alreadyBooked || next.stage === "handoff") {
    await saveAgentSession(next);
    return next;
  }

  const link = bookingLinkUrl();
  const body = bookingLinkResendCopy(link);

  if (messageSid) {
    const sendResult = await sendSmsWithState({
      key: sendStateKeys.bookingLinkResend(next.phone, next.createdAt, messageSid),
      to: next.phone,
      body,
    });
    if (sendResult.outcome === "sent") {
      next = appendMessage(next, "assistant", body);
      next = { ...next, bookingLinkLastSentAt: now };
      await saveAgentSession(next);
    } else if (sendResult.outcome === "already_sent" || sendResult.outcome === "indeterminate") {
      await saveAgentSession(next);
      return next;
    } else {
      return next;
    }
  } else {
    await sendSms(next.phone, body);
    next = appendMessage(next, "assistant", body);
    next = { ...next, bookingLinkLastSentAt: now };
    await saveAgentSession(next);
  }

  const exhausted = Boolean(next.bookingLinkFollowUpResolved);
  logAppointmentEvent(exhausted ? "booking_link_resent_after_campaign_exhausted" : "booking_link_resent", {
    phone: next.phone,
  });
  return next;
}

export function markBridgeDelivered(session: AgentSession): AgentSession {
  if (session.stage !== "bridge" || session.bridgeDeliveredAt) {
    return session;
  }
  return { ...session, bridgeDeliveredAt: new Date().toISOString() };
}

export async function maybeEscalateHumanFromPending(
  session: AgentSession,
  body: string,
): Promise<AgentSession | null> {
  if (isExplicitHumanRequest(body)) {
    const next = await persistHumanFollowUp(session, "explicit_human_request");
    await sendHumanAlert({
      reason: "explicit_human_request",
      subjectId: session.phone,
      body: `S2L explicit human request from ${session.phone} (${session.flow}).`,
    });
    return next;
  }
  if (isOutOfBandRequest(body)) {
    const next = await persistHumanFollowUp(session, "out_of_band_request");
    await sendHumanAlert({
      reason: "out_of_band_request",
      subjectId: session.phone,
      body: `S2L out-of-band request from ${session.phone}: ${body.slice(0, 160)}`,
    });
    return next;
  }
  if (session.stage === "booking_link_pending" && isManualBookingRequest(body)) {
    const alreadyRedirected = session.bookingLinkLastSentAt !== session.bookingLinkSentAt;
    if (alreadyRedirected) {
      const next = await persistHumanFollowUp(session, "manual_help_after_redirect");
      await sendHumanAlert({
        reason: "manual_help_after_redirect",
        subjectId: session.phone,
        body: `S2L manual booking insist after redirect from ${session.phone}.`,
      });
      return next;
    }
  }
  return null;
}
