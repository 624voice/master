import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import type { ConversationDisposition } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const TIMING_PUSHBACK_RE =
  /\b(not right now|not now|i'?m busy|im busy|busy right now|too busy|maybe later|check back later|another time|reach out later|talk later|no time right now|can'?t talk now|cant talk now)\b/i;

const GENERIC_ACK_RE =
  /^(?:ok(?:ay)?|k|thanks|thank you|thx|got it|sounds good|cool|👍|🙏|sure\.?|yep\.?|yeah\.?|will do|no problem|np)\.?$/i;

const SUBSTANTIVE_REENGAGEMENT_RE =
  /\b(how much|price|pricing|cost|what does|how does|can we|let'?s talk|schedule|book|tomorrow|monday|tuesday|wednesday|thursday|friday|appointment|call me|send me|what about|actually|interested|tell me|explain|walk me through|next week|when can|what time|morning|afternoon|evening|\?)\b/i;

export function detectTimingPushback(message: string): boolean {
  return TIMING_PUSHBACK_RE.test(message.trim());
}

export function isGenericAcknowledgment(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (GENERIC_ACK_RE.test(trimmed)) return true;
  if (trimmed.length <= 3 && /^(ok|k|ty|thx)$/i.test(trimmed)) return true;
  return false;
}

export function isSubstantiveReengagement(message: string): boolean {
  if (isGenericAcknowledgment(message)) return false;
  const signals = analyzeMessage(message);
  if (signals.explicitMeetingReady) return true;
  if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) return true;
  if (signals.pains.length > 0 && signals.hasSubstance) return true;
  if (SUBSTANTIVE_REENGAGEMENT_RE.test(message)) return true;
  return message.trim().length > 20;
}

export function resolveDispositionAfterInbound(
  context: AnyConversationContext,
  inboundMessage: string,
): ConversationDisposition {
  const current = context.disposition ?? "active";
  const signals = analyzeMessage(inboundMessage);

  if (context.scheduling?.status === "confirmed") {
    return "booked";
  }

  if (signals.stop || signals.decline || signals.notInterested) {
    return "declined";
  }

  if (detectTimingPushback(inboundMessage)) {
    return "soft_closed";
  }

  if (current === "soft_closed") {
    if (isSubstantiveReengagement(inboundMessage)) {
      return "active";
    }
    return "soft_closed";
  }

  if (current === "declined" && isSubstantiveReengagement(inboundMessage)) {
    return "active";
  }

  return current;
}

export function shouldBlockSchedulingTurn(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  const disposition = context.disposition ?? "active";
  if (disposition === "declined" || disposition === "booked") {
    return !isSubstantiveReengagement(inboundMessage);
  }
  if (disposition === "soft_closed") {
    return isGenericAcknowledgment(inboundMessage) || !isSubstantiveReengagement(inboundMessage);
  }
  return false;
}

export function shouldTreatAsStrongInterest(
  message: string,
  context: AnyConversationContext,
): boolean {
  if (shouldBlockSchedulingTurn(context, message)) {
    return false;
  }
  if (isGenericAcknowledgment(message)) {
    return false;
  }
  return true;
}
