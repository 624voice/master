import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";
import {
  buildCalendarFetchFailureCopy,
  buildNeedDateCopy,
  buildNoAvailabilityCopy,
  buildSchedulingHandoffCopy,
  buildSlotOfferCopy,
} from "~/server/speed2Lead/agent/scheduling/copy";
import type { OfferPresentationType } from "~/server/speed2Lead/agent/scheduling/types";
import { isSchedulingPreferenceOnly } from "~/server/speed2Lead/agent/slotPreferences";

const UNAUTHORIZED_PLATFORM_RE = /\b(zoom|microsoft teams|teams meeting|webex)\b/i;
const FABRICATED_BOOKING_RE =
  /\b(i('|')?ve|i have)\s+(booked|scheduled|set|got)\s+(you|us|that|it)\b/i;
const CONFIRMED_YOU_RE = /\b(you'?re|you are)\s+(all set|confirmed|booked)\b/i;

function presentationForTurn(session: AgentSession, offeredCount: number): OfferPresentationType {
  if (offeredCount === 0) return "first_offer";
  const hadPriorOffer = (session.offeredSlots?.length ?? 0) > 0;
  return hadPriorOffer ? "changed_offer" : "first_offer";
}

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

function inDiscoveryFlowScheduling(session: AgentSession): boolean {
  return (
    session.stage === "offering_slots" ||
    session.stage === "confirming" ||
    (session.discoveryClosed && (session.stage === "bridge" || session.stage === "offering_slots"))
  );
}

/** Shared scheduling reply builder for contact/demo discovery flows (ROI uses the same copy helpers). */
export function buildDiscoverySchedulingTurnReply(args: {
  session: AgentSession;
  inboundBody: string;
  offered: OfferedSlot[];
  fetchFailed: boolean;
  profile: AgentProfile;
  llmReply: string;
  now?: Date;
}): string | null {
  const now = args.now ?? new Date();
  if (!inDiscoveryFlowScheduling(args.session)) return null;

  if (args.fetchFailed) {
    if (looksLikeFabricatedBookingClaim(args.llmReply)) {
      return buildSchedulingHandoffCopy();
    }
  }

  const prefOnly = isSchedulingPreferenceOnly(args.inboundBody, args.session, now);
  if (!prefOnly) return null;

  if (args.fetchFailed) {
    return buildCalendarFetchFailureCopy();
  }

  if (args.offered.length > 0) {
    const isos = args.offered.map((slot) => slot.startIso);
    return buildSlotOfferCopy(isos, presentationForTurn(args.session, isos.length));
  }

  if (args.session.requestedDate) {
    return buildNoAvailabilityCopy(true);
  }

  return buildNeedDateCopy();
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
    if (stage === "booked") stage = "confirming";
  }

  if (looksLikeFabricatedBookingClaim(reply) && !args.bookingConfirmed) {
    reply = buildSchedulingHandoffCopy();
    session = flagSchedulingFailure(session, "fabricated_booking_claim");
    flaggedFailure = true;
    if (stage === "booked") stage = "confirming";
  }

  if (stage === "booked" && !args.bookingConfirmed && !session.bookedEventId) {
    stage =
      session.stage === "confirming" || session.requestedDate
        ? "confirming"
        : "offering_slots";
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
