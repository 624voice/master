import type { AgentSession } from "~/server/speed2Lead/agent/state";
import { buildSchedulingHandoffCopy } from "~/server/speed2Lead/agent/scheduling/copy";

const UNAUTHORIZED_PLATFORM_RE = /\b(zoom|microsoft teams|teams meeting|webex)\b/i;
const FABRICATED_BOOKING_RE =
  /\b(i('|')?ve|i have)\s+(booked|scheduled|set|got)\s+(you|us|that|it)\b/i;
const CONFIRMED_YOU_RE = /\b(you'?re|you are)\s+(all set|confirmed|booked)\b/i;

export function looksLikeFabricatedBookingClaim(text: string): boolean {
  const lower = text.toLowerCase();
  if (FABRICATED_BOOKING_RE.test(lower)) return true;
  if (CONFIRMED_YOU_RE.test(lower)) return true;
  if (/\b(great|perfect),?\s+(i('|')?ve|you'?re)\b/.test(lower) && /\b(booked|scheduled|confirmed)\b/.test(lower)) {
    return true;
  }
  if (/\bsee you\b/.test(lower) && /\b(tomorrow|monday|tuesday|wednesday|thursday|friday|\d{1,2}(:\d{2})?\s*(am|pm))\b/.test(lower)) {
    return true;
  }
  if (/\b(i('|')?ll send|here'?s)\s+(the|your)\s+(zoom|teams|meeting)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function looksLikeUnauthorizedMeetingPlatform(text: string): boolean {
  return UNAUTHORIZED_PLATFORM_RE.test(text);
}

/** Keep the first question only — Chris wants one distinct ask per SMS. */
export function enforceAtMostOneQuestion(text: string): string {
  let trimmed = stripCombinedBridgeAndDayAsk(text);
  const firstQ = trimmed.indexOf("?");
  if (firstQ === -1) return trimmed.trim();
  const secondQ = trimmed.indexOf("?", firstQ + 1);
  if (secondQ === -1) return trimmed.trim();
  return trimmed.slice(0, firstQ + 1).trim();
}

/** Bridge close and day-ask must never ship in the same SMS. */
export function stripCombinedBridgeAndDayAsk(text: string): string {
  const lower = text.toLowerCase();
  const hasBridge =
    lower.includes("worth 25 minutes") ||
    lower.includes("worth a quick 25") ||
    (lower.includes("without adding") && lower.includes("headcount"));
  const hasDayAsk =
    lower.includes("what day works best") ||
    lower.includes("which day works best") ||
    lower.includes("what day or time range works best");
  if (!hasBridge || !hasDayAsk) return text.trim();

  const dayPatterns = [
    "what day or time range works best",
    "what day works best",
    "which day works best",
  ];
  let dayIdx = -1;
  for (const pattern of dayPatterns) {
    const idx = lower.indexOf(pattern);
    if (idx !== -1 && (dayIdx === -1 || idx < dayIdx)) {
      dayIdx = idx;
    }
  }
  if (dayIdx > 0) {
    let bridge = text
      .slice(0, dayIdx)
      .trim()
      .replace(/[,.\s]+\b(and|then)\s*$/i, "")
      .trim();
    if (!bridge.endsWith("?")) {
      bridge = `${bridge}?`;
    }
    return bridge;
  }

  const firstQ = text.indexOf("?");
  if (firstQ !== -1) {
    return text.slice(0, firstQ + 1).trim();
  }
  return text.trim();
}

export function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

export function flagSchedulingFailure(session: AgentSession, reason: string): AgentSession {
  console.warn("Speed2Lead scheduling failure flagged for follow-up", {
    phoneSuffix: session.phone.slice(-4),
    reason,
    stage: session.stage,
    requestedDate: session.requestedDate,
  });
  return {
    ...session,
    schedulingFailureAt: new Date().toISOString(),
    schedulingFailureReason: reason,
  };
}

export type GuardAgentReplyArgs = {
  reply: string;
  session: AgentSession;
  fetchFailed: boolean;
  modelStage: AgentSession["stage"];
  bookingConfirmed: boolean;
};

export type GuardAgentReplyResult = {
  reply: string;
  session: AgentSession;
  stage: AgentSession["stage"];
  flaggedFailure: boolean;
};

/** True only after a real calendar event id was persisted on the session. */
export function hasRealBooking(session: AgentSession): boolean {
  return Boolean(session.bookedEventId);
}

/**
 * Terminal stages the LLM/guard must not roll back: a real completed booking,
 * or an explicit decline. A "booked" stage without bookedEventId is a fake
 * claim and is not protected.
 */
export function shouldPreserveTerminalStage(session: AgentSession): boolean {
  return (
    session.stage === "declined" ||
    session.stage === "handoff" ||
    session.stage === "booking_link_pending" ||
    (session.stage === "booked" && hasRealBooking(session))
  );
}

function rollFakeBookedToBridge(
  session: AgentSession,
  stage: AgentSession["stage"],
): { session: AgentSession; stage: AgentSession["stage"] } {
  if (stage !== "booked") {
    return { session, stage };
  }
  return { session: { ...session, stage: "bridge" }, stage: "bridge" };
}

/** Code-owned guardrails — never trust LLM booking language without a real event ID. */
export function guardAgentReply(args: GuardAgentReplyArgs): GuardAgentReplyResult {
  let reply = enforceAtMostOneQuestion(args.reply);
  let session = args.session;
  let stage = args.modelStage;
  let flaggedFailure = false;

  if (looksLikeUnauthorizedMeetingPlatform(reply) && !args.bookingConfirmed) {
    reply = buildSchedulingHandoffCopy();
    session = flagSchedulingFailure(session, "unauthorized_meeting_platform");
    flaggedFailure = true;
    ({ session, stage } = rollFakeBookedToBridge(session, stage));
  }

  if (looksLikeFabricatedBookingClaim(reply) && !args.bookingConfirmed) {
    reply = buildSchedulingHandoffCopy();
    session = flagSchedulingFailure(session, "fabricated_booking_claim");
    flaggedFailure = true;
    ({ session, stage } = rollFakeBookedToBridge(session, stage));
  }

  if (stage === "booked" && !args.bookingConfirmed && !session.bookedEventId) {
    // Fake booked claims cannot become BOOKED. Roll to bridge; booking-link
    // handoff is the only meeting-conversion path.
    ({ session, stage } = rollFakeBookedToBridge(session, stage));
    if (!flaggedFailure) {
      reply = buildSchedulingHandoffCopy();
      session = flagSchedulingFailure(session, "booked_stage_without_event");
      flaggedFailure = true;
    }
  }

  if (
    args.fetchFailed &&
    !args.bookingConfirmed &&
    (session.stage === "offering_slots" ||
      session.stage === "confirming" ||
      session.requestedDate)
  ) {
    if (looksLikeFabricatedBookingClaim(reply)) {
      reply = buildSchedulingHandoffCopy();
      session = flagSchedulingFailure(session, "calendar_fetch_with_fake_booking");
      flaggedFailure = true;
    }
  }

  return { reply, session, stage, flaggedFailure };
}
