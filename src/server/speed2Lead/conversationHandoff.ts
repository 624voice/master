import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
} from "~/server/speed2Lead/schedulingContext";
import { isDiscoveryComplete, normalizeDiscoveryFacts } from "~/server/speed2Lead/discoveryProgress";
import {
  isMeetingInterestConfirmed,
  withMeetingInterestConfirmed,
} from "~/server/speed2Lead/meetingInterest";
import type { KnownFacts, TurnSemantics } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const EXPLICIT_SCHEDULING_RE =
  /\b(let'?s talk|let'?s meet|schedule|book(?:ing)?|appointment|set up a call|grab a time|find a time|when works|what day|what time|what times|tomorrow|monday|tuesday|wednesday|thursday|friday|next week|this week|when are you available|any openings?)\b/i;

const MEETING_BRIDGE_AGREEMENT_RE =
  /\b(yes|yeah|yep|sure|ok(?:ay)?|sounds good|makes sense|let'?s do it|lets do it|worth a look|i'?m open to it|im open to it|that works|let'?s look|lets look|happy to|go ahead|absolutely|definitely|of course|for sure|fine)\b/i;

export const UNCERTAINTY_PHRASE_RE =
  /\b(not sure|no idea|don't know|dont know|unsure|maybe|i guess|hard to say|can't say|cant say)\b/i;

const BRIDGE_LANGUAGE_RE =
  /\b(25[\s-]?min(?:ute)?s?|quick (?:look|chat|walkthrough)|worth a (?:look|chat)|open to (?:it|a)|make sense to (?:talk|look|walk)|walk through|walkthrough)\b/i;

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
  const lower = trimmed.toLowerCase();
  if (UNCERTAINTY_PHRASE_RE.test(lower)) return false;
  return MEETING_BRIDGE_AGREEMENT_RE.test(trimmed);
}

export function meetingBridgeQuestionDelivered(context: AnyConversationContext): boolean {
  return (context.messages ?? []).some(
    (message) => message.role === "assistant" && BRIDGE_LANGUAGE_RE.test(message.content),
  );
}

export function hasOngoingSchedulingState(context: AnyConversationContext): boolean {
  const scheduling = context.scheduling;
  if (!scheduling) return false;
  if (scheduling.status === "slots_offered" || scheduling.status === "confirmed") {
    return true;
  }
  if ((scheduling.offeredSlots?.length ?? 0) > 0) {
    return true;
  }
  return Boolean(
    scheduling.requestedDate ??
      scheduling.centralDate ??
      scheduling.availabilityPreference ??
      (scheduling.partOfDay && scheduling.partOfDay !== "full_day") ??
      scheduling.anchorTimeMinutes,
  );
}

/** Single gate for legal scheduling entry — one behavior, one owner. */
export function canEnterScheduling(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  if (context.scheduling?.status === "confirmed") {
    return true;
  }
  if (detectExplicitSchedulingRequest(inboundMessage)) {
    return true;
  }
  if (isMeetingInterestConfirmed(context.knownFacts)) {
    return true;
  }
  if (hasOngoingSchedulingState(context)) {
    return true;
  }
  return false;
}

export function shouldRequireMeetingBridge(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  if (context.flow !== "roi" && context.flow !== "contact") return false;
  if (isMeetingInterestConfirmed(context.knownFacts)) return false;
  if (context.disposition === "soft_closed" || context.disposition === "declined") return false;
  if (context.scheduling?.status === "confirmed") return false;
  if (detectExplicitSchedulingRequest(inboundMessage)) return false;
  if (hasKnownSchedulingDay(context.scheduling)) return false;

  const facts = normalizeDiscoveryFacts(context.knownFacts ?? ({} as KnownFacts));
  const painKnown = Boolean(facts.primaryPain);
  if (!painKnown && context.flow !== "contact") return false;
  return true;
}

export function shouldBlockSchedulingForMeetingBridge(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  if (isMeetingInterestConfirmed(context.knownFacts)) return false;
  if (detectExplicitSchedulingRequest(inboundMessage)) return false;
  return shouldRequireMeetingBridge(context, inboundMessage);
}

export function applyMeetingBridgeProgress<T extends AnyConversationContext>(
  context: T,
  inboundMessage: string,
  semantics?: TurnSemantics,
): T {
  if (isMeetingInterestConfirmed(context.knownFacts)) {
    return context;
  }

  const facts = (context.knownFacts ?? {}) as KnownFacts;

  if (
    detectExplicitSchedulingRequest(inboundMessage) ||
    hasKnownSchedulingDay(context.scheduling) ||
    hasKnownSchedulingPartOfDay(context.scheduling)
  ) {
    return {
      ...context,
      knownFacts: withMeetingInterestConfirmed(facts),
    } as T;
  }

  const bridgeAgreement =
    detectMeetingBridgeAgreement(inboundMessage) || semantics?.kind === "meeting_interest_yes";

  if (bridgeAgreement && meetingBridgeQuestionDelivered(context)) {
    return {
      ...context,
      knownFacts: withMeetingInterestConfirmed(facts),
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
