import type { AgentSession } from "~/server/speed2Lead/agent/state";
import { isDirectMeetingIntent, isPricingQuestion } from "~/server/speed2Lead/agent/contactFlow/intentDetect";
import { isSchedulingPreferenceOnly } from "~/server/speed2Lead/agent/slotPreferences";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";

export const CONTACT_MAX_DISCOVERY_QUESTIONS = 2;
export const DEMO_MAX_DISCOVERY_QUESTIONS = 2;

export function maxDiscoveryQuestionsForFlow(flow: AgentSession["flow"]): number {
  if (flow === "demo") return DEMO_MAX_DISCOVERY_QUESTIONS;
  if (flow === "contact") return CONTACT_MAX_DISCOVERY_QUESTIONS;
  return 0;
}

export function canAskDiscoveryQuestion(
  session: AgentSession,
  maxQuestions = maxDiscoveryQuestionsForFlow(session.flow),
): boolean {
  if (session.discoveryClosed) return false;
  return (session.discoveryQuestionCount ?? 0) < maxQuestions;
}

export function markDiscoveryQuestionAsked(session: AgentSession): AgentSession {
  if (session.discoveryClosed) return session;
  const maxQuestions = maxDiscoveryQuestionsForFlow(session.flow);
  const count = (session.discoveryQuestionCount ?? 0) + 1;
  return {
    ...session,
    discoveryQuestionCount: count,
    discoveryClosed: count >= maxQuestions ? true : session.discoveryClosed,
  };
}

export function closeDiscovery(session: AgentSession): AgentSession {
  return { ...session, discoveryClosed: true };
}

export function shouldCloseDiscoveryFromInbound(body: string, session: AgentSession): boolean {
  if (session.discoveryClosed) return false;
  if (isDirectMeetingIntent(body)) return true;
  if (session.flow === "contact" && session.inquiryClarity === "already_clear") return true;
  return false;
}

export function shouldCloseDiscoveryFromModel(output: {
  wants_meeting: boolean;
  confirm_booking: boolean;
}): boolean {
  return output.wants_meeting || output.confirm_booking;
}

export function replyContainsQuestion(reply: string): boolean {
  return reply.includes("?");
}

export function isConsequenceQuestion(reply: string): boolean {
  const lower = reply.toLowerCase();
  return (
    lower.includes("what's that been costing") ||
    lower.includes("how's that been affecting") ||
    lower.includes("what has that been costing")
  );
}

export function looksLikeBridgeQuestion(reply: string): boolean {
  const lower = reply.toLowerCase();
  return (
    lower.includes("worth 25 minutes") ||
    lower.includes("worth a quick 25") ||
    (lower.includes("without adding") && lower.includes("headcount"))
  );
}

export function discoveryRequirementsMet(
  session: AgentSession,
  inboundBody: string,
  maxQuestions = maxDiscoveryQuestionsForFlow(session.flow),
): boolean {
  if (session.flow === "contact" && session.inquiryClarity === "already_clear") return true;
  if (session.discoveryClosed) return true;
  if ((session.discoveryQuestionCount ?? 0) >= maxQuestions) return true;
  return isDirectMeetingIntent(inboundBody);
}

export function shouldBlockDiscoveryReply(
  session: AgentSession,
  reply: string,
  inboundBody?: string,
): boolean {
  if (
    inboundBody &&
    (session.stage === "offering_slots" || session.stage === "confirming") &&
    isSchedulingPreferenceOnly(inboundBody, session)
  ) {
    return false;
  }
  if (
    inboundBody &&
    session.flow === "contact" &&
    (session.stage === "discovery" || session.stage === "bridge") &&
    isSchedulingPreferenceOnly(inboundBody, session, new Date(), getActiveProfile())
  ) {
    return false;
  }

  if (
    !session.discoveryClosed &&
    !canAskDiscoveryQuestion(session) &&
    replyContainsQuestion(reply)
  ) {
    return true;
  }
  if (session.discoveryClosed && replyContainsQuestion(reply) && !isPricingQuestion(reply)) {
    const lower = reply.toLowerCase();
    if (lower.includes("what day") || lower.includes("which time") || lower.includes("works best")) {
      return false;
    }
    if (/\b(morning|afternoon|schedule|available|slot)\b/.test(lower)) {
      return false;
    }
    return true;
  }
  return false;
}

export function buildDiscoveryClosedFallback(session: AgentSession): string {
  if (session.stage === "offering_slots" || session.stage === "confirming") {
    return "What day or time range works best for a quick 25-minute chat?";
  }
  return "What day works best for a quick 25-minute chat?";
}
