import type { AgentSession } from "~/server/speed2Lead/agent/state";
import {
  isDirectMeetingIntent,
  isPricingQuestion,
} from "~/server/speed2Lead/agent/contactFlow/intentDetect";

export const MAX_DISCOVERY_QUESTIONS = 2;

export function canAskDiscoveryQuestion(session: AgentSession): boolean {
  if (session.discoveryClosed) return false;
  return (session.discoveryQuestionCount ?? 0) < MAX_DISCOVERY_QUESTIONS;
}

export function markDiscoveryQuestionAsked(session: AgentSession): AgentSession {
  if (session.discoveryClosed) return session;
  const count = (session.discoveryQuestionCount ?? 0) + 1;
  return {
    ...session,
    discoveryQuestionCount: count,
    discoveryClosed: count >= MAX_DISCOVERY_QUESTIONS ? true : session.discoveryClosed,
  };
}

export function closeDiscovery(session: AgentSession): AgentSession {
  return { ...session, discoveryClosed: true };
}

export function shouldCloseDiscoveryFromInbound(body: string, session: AgentSession): boolean {
  if (session.discoveryClosed) return false;
  if (isDirectMeetingIntent(body)) return true;
  if (session.inquiryClarity === "already_clear") return true;
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

export function shouldBlockDiscoveryReply(session: AgentSession, reply: string): boolean {
  if (!session.discoveryClosed && !canAskDiscoveryQuestion(session) && replyContainsQuestion(reply)) {
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
