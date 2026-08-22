import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
} from "~/server/speed2Lead/schedulingContext";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const EXPLICIT_SCHEDULING_RE =
  /\b(let'?s talk|let'?s meet|schedule|book(?:ing)?|appointment|set up a call|grab a time|find a time|when works|what day|what time|what times|tomorrow|monday|tuesday|wednesday|thursday|friday|next week|this week|when are you available|any openings?)\b/i;

const MEETING_BRIDGE_AGREEMENT_RE =
  /\b(yes|yeah|yep|sure|ok(?:ay)?|sounds good|makes sense|let'?s do it|lets do it|worth a look|i'?m open to it|im open to it|that works|let'?s look|lets look|happy to|go ahead)\b/i;

export function detectExplicitSchedulingRequest(message: string): boolean {
  if (analyzeMessage(message).explicitMeetingReady) {
    return true;
  }
  return EXPLICIT_SCHEDULING_RE.test(message.trim());
}

export function detectMeetingBridgeAgreement(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (detectExplicitSchedulingRequest(trimmed)) return true;
  return MEETING_BRIDGE_AGREEMENT_RE.test(trimmed);
}

export function shouldRequireMeetingBridge(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  if (context.flow !== "roi") return false;
  if (context.knownFacts?.meetingBridgeComplete) return false;
  if (context.disposition === "soft_closed" || context.disposition === "declined") return false;
  if (context.scheduling?.status === "confirmed") return false;
  if (detectExplicitSchedulingRequest(inboundMessage)) return false;
  if (hasKnownSchedulingDay(context.scheduling)) return false;

  const facts = context.knownFacts;
  const painKnown = Boolean(
    facts?.primaryPain || (context.detectedPains?.length ?? 0) > 0,
  );
  if (!painKnown) return false;
  if ((facts?.questionsAsked ?? 0) < 1) return false;
  return true;
}

export function shouldBlockSchedulingForMeetingBridge(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  return shouldRequireMeetingBridge(context, inboundMessage);
}

export function applyMeetingBridgeProgress<T extends AnyConversationContext>(
  context: T,
  inboundMessage: string,
): T {
  if (context.knownFacts?.meetingBridgeComplete) {
    return context;
  }

  if (
    detectExplicitSchedulingRequest(inboundMessage) ||
    detectMeetingBridgeAgreement(inboundMessage) ||
    hasKnownSchedulingDay(context.scheduling) ||
    hasKnownSchedulingPartOfDay(context.scheduling)
  ) {
    return {
      ...context,
      knownFacts: {
        ...(context.knownFacts as KnownFacts),
        meetingBridgeComplete: true,
      },
    } as T;
  }

  return context;
}

/** Prospect name belongs only in opening SMS and final booking confirmation. */
export function outboundMayIncludeProspectName(context: AnyConversationContext): boolean {
  return context.scheduling?.status === "confirmed";
}

export function countProspectNameMentions(text: string, firstName: string): number {
  if (!firstName.trim()) return 0;
  const escaped = firstName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`\\b${escaped}\\b`, "gi")) ?? []).length;
}
