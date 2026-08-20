import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { SPEED2LEAD_LLM_MAX_SMS_LENGTH } from "~/server/speed2Lead/config";
import {
  buildContextualSlotOfferMessage,
  buildSlotOfferMessage,
  type SlotOfferContext,
  type SlotOfferSituation,
} from "~/server/speed2Lead/schedulingReply";
export {
  buildContextualSlotOfferMessage,
  buildSlotOfferMessage,
  type SlotOfferContext,
  type SlotOfferSituation,
} from "~/server/speed2Lead/schedulingReply";
import type { ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type GuardrailContext = {
  session: AnyConversationContext;
  toolState: ToolExecutionState;
};

export type GuardrailResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

const MARKDOWN_PATTERN = /(\*\*|__|```|^#|\n\s*[-*]\s)/;
const EXACT_PRICE_PATTERN =
  /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+\s?(?:per month|\/mo|monthly|annual|year)\b/i;
const BOOKED_CLAIM_PATTERN =
  /\b(you(?:'re| are)? (?:all )?set|booked|confirmed|see you then|you're on the calendar|appointment is set)\b/i;
const IMPLIED_AVAILABILITY_PATTERN =
  /\b(i have (?:some )?openings?|here are (?:some )?(?:times|slots|options)|let me find a time|let's find a time|find a time that works|let me check (?:my )?availability)\b/i;
const GUARANTEE_PATTERN =
  /\b(guarantee|guaranteed|will (?:make|save|earn)|promise you'll)\b/i;
const CRM_INTEGRATION_CLAIM_PATTERN =
  /\b(yes,? we (?:can|do)|we can|we do|sync(?:s|ed|ing)?|integrat(?:e|es|ed|ing))\b[^.\n]{0,80}\b(servicetitan|housecall pro|jobber|fieldpulse|hcp|crm)\b/i;

function allowedRoiPriceTokens(session: AnyConversationContext): string[] {
  if (session.flow !== "roi" && !("annualOpportunity" in session)) {
    return [];
  }
  const roi = session as AnyConversationContext & { annualOpportunity?: string };
  return roi.annualOpportunity ? [roi.annualOpportunity.replace(/\s+/g, " ").trim()] : [];
}

function containsDisallowedPrice(text: string, allowedTokens: string[]): boolean {
  if (!EXACT_PRICE_PATTERN.test(text)) {
    return false;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  return !allowedTokens.some((token) => token && normalized.includes(token));
}

function slotTimeVariants(iso: string): string[] {
  const { time } = formatTimeOnly(iso, CONSULTATION_TIMEZONE);
  const lower = time.toLowerCase();
  const withoutPeriod = lower.replace(/\s*(am|pm)/, "").trim();
  return [lower, withoutPeriod, withoutPeriod.replace(":", "")];
}

function mentionsUnlistedTime(text: string, allowedSlots: string[]): boolean {
  const timePattern = /\b(?:1[0-2]|0?[1-9]):[0-5]\d(?:\s*(?:am|pm))?\b/gi;
  const matches = text.match(timePattern) ?? [];
  if (matches.length === 0) {
    return false;
  }

  if (allowedSlots.length === 0) {
    return matches.length > 0;
  }

  const allowedVariants = new Set(allowedSlots.flatMap((slot) => slotTimeVariants(slot)));

  return matches.some((match) => {
    const token = match.toLowerCase().replace(/\s*(am|pm)/, "").trim();
    return !allowedVariants.has(token) && !allowedVariants.has(match.toLowerCase().trim());
  });
}

export function validateOutboundSms(text: string, ctx: GuardrailContext): GuardrailResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: "Empty SMS draft" };
  }

  if (trimmed.length > SPEED2LEAD_LLM_MAX_SMS_LENGTH) {
    return {
      ok: false,
      reason: `SMS exceeds ${SPEED2LEAD_LLM_MAX_SMS_LENGTH} characters`,
    };
  }

  if (MARKDOWN_PATTERN.test(trimmed)) {
    return { ok: false, reason: "SMS contains markdown formatting" };
  }

  if (containsDisallowedPrice(trimmed, allowedRoiPriceTokens(ctx.session))) {
    return { ok: false, reason: "SMS contains exact pricing" };
  }

  if (GUARANTEE_PATTERN.test(trimmed)) {
    return { ok: false, reason: "SMS contains unsupported guarantee language" };
  }

  if (CRM_INTEGRATION_CLAIM_PATTERN.test(trimmed)) {
    const hedged =
      /\b(depends on|consultation|scope|mapped out|reviewed|varies|not sure|typically|usually)\b/i.test(
        trimmed,
      );
    if (!hedged) {
      return { ok: false, reason: "SMS claims a CRM integration that is not verified" };
    }
  }

  if (BOOKED_CLAIM_PATTERN.test(trimmed) && !ctx.toolState.bookingConfirmed) {
    return { ok: false, reason: "SMS claims booking without successful booking tool result" };
  }

  if (
    IMPLIED_AVAILABILITY_PATTERN.test(trimmed) &&
    ctx.toolState.offeredSlots.length === 0 &&
    !ctx.toolState.bookingConfirmed
  ) {
    return { ok: false, reason: "SMS implies availability without tool results" };
  }

  const allowedSlots = [
    ...ctx.toolState.offeredSlots,
    ...(ctx.toolState.bookingStart ? [ctx.toolState.bookingStart] : []),
  ];

  if (mentionsUnlistedTime(trimmed, allowedSlots)) {
    return { ok: false, reason: "SMS mentions a calendar time that was not returned by tools" };
  }

  return { ok: true, text: trimmed };
}

export function buildBookingConfirmationMessage(start: string, firstName: string): string {
  const { time, timezoneShort } = formatTimeOnly(start, CONSULTATION_TIMEZONE);
  const tz = timezoneShort ? ` ${timezoneShort}` : "";
  return `You're all set for ${time}${tz}, ${firstName}.`;
}

export function calendarLinkFallbackMessage(context: AnyConversationContext): string {
  const firstName = context.firstName ?? "there";
  return `No problem, ${firstName}. If it's easier, you can grab a time here: ${context.bookingUrl}`;
}

export function genericRecoveryMessage(context: AnyConversationContext): string {
  return `Hey ${context.firstName}, Chris with 624Voice — I hit a snag on my side. Mind sending that again?`;
}

export function llmUnavailableFallbackMessage(context: AnyConversationContext): string {
  return genericRecoveryMessage(context);
}
