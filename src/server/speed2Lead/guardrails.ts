import { formatNaturalAppointmentParts, formatNaturalTime } from "~/server/appointmentLifecycle/formatTime";
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
import { filterSlotsForSchedulingState } from "~/server/speed2Lead/schedulingContext";

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
const PENDING_ACTION_PATTERN =
  /\b(let me check what i have open|booking that now|i'?m checking availability|checking availability now)\b/i;
const EXACT_PHRASE_CONFIRM_PATTERN =
  /\b(reply with exactly|exactly \"|exact phrase|didn'?t get the exact)\b/i;
const REDUNDANT_CONFIRM_PATTERN =
  /\b(confirm you want|before i can book|lock that in|need you to confirm)\b/i;
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
  const { time } = formatNaturalTime(iso, CONSULTATION_TIMEZONE);
  const lower = time.toLowerCase();
  const withoutMeridiem = lower.replace(/(am|pm)/, "").trim();
  return [lower, withoutMeridiem, withoutMeridiem.replace(":", "")];
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
    PENDING_ACTION_PATTERN.test(trimmed) &&
    !ctx.toolState.bookingConfirmed &&
    ctx.toolState.offeredSlots.length === 0
  ) {
    return { ok: false, reason: "SMS sends pending-work message without completed action" };
  }

  if (
    PENDING_ACTION_PATTERN.test(trimmed) &&
    !ctx.toolState.bookingConfirmed &&
    /\bbooking that now\b/i.test(trimmed)
  ) {
    return { ok: false, reason: "SMS claims booking in progress without completed booking" };
  }

  if (EXACT_PHRASE_CONFIRM_PATTERN.test(trimmed)) {
    return { ok: false, reason: "SMS requires exact confirmation phrase" };
  }

  if (
    REDUNDANT_CONFIRM_PATTERN.test(trimmed) &&
    ctx.session.scheduling?.status === "slots_offered" &&
    (ctx.session.scheduling?.offeredSlots?.length ?? 0) > 0
  ) {
    return { ok: false, reason: "SMS asks redundant booking confirmation after slot selection" };
  }

  if (
    IMPLIED_AVAILABILITY_PATTERN.test(trimmed) &&
    ctx.toolState.offeredSlots.length === 0 &&
    !ctx.toolState.bookingConfirmed
  ) {
    return { ok: false, reason: "SMS implies availability without tool results" };
  }

  const allowedSlots = [
    ...filterSlotsForSchedulingState(ctx.toolState.offeredSlots, ctx.session.scheduling),
    ...(ctx.toolState.bookingStart ? [ctx.toolState.bookingStart] : []),
  ];

  if (mentionsUnlistedTime(trimmed, allowedSlots)) {
    return { ok: false, reason: "SMS mentions a calendar time that was not returned by tools" };
  }

  if (
    ctx.session.scheduling?.partOfDay &&
    ctx.session.scheduling.partOfDay !== "full_day" &&
    allowedSlots.length > 0 &&
    filterSlotsForSchedulingState(allowedSlots, ctx.session.scheduling).length !==
      allowedSlots.length
  ) {
    return { ok: false, reason: "SMS offers slots outside the active daypart constraint" };
  }

  return { ok: true, text: trimmed };
}

export function buildBookingConfirmationMessage(
  start: string,
  firstName: string,
  options: {
    email?: string;
    sendsCalendarInvite?: boolean;
    useLifecycleCopy?: boolean;
  } = {},
): string {
  const { weekday, month, day, time, timezoneShort } = formatNaturalAppointmentParts(
    start,
    CONSULTATION_TIMEZONE,
  );
  const tz = timezoneShort ? ` ${timezoneShort}` : "";
  const dateLabel = `${weekday}, ${month} ${day}`;

  if (options.useLifecycleCopy) {
    return "";
  }

  let message = `Got you booked for ${dateLabel} at ${time}${tz}, ${firstName}.`;
  if (options.sendsCalendarInvite && options.email) {
    message += ` I'll send the calendar invite to ${options.email}.`;
  } else if (options.email) {
    message += ` I'll send the details to ${options.email}.`;
  } else {
    message += ` I'll send a reminder before we meet.`;
  }
  return message;
}

const UNAUTHORIZED_SELF_SCHEDULE_COPY_RE =
  /\b(?:grab|pick|choose|select)\s+(?:a\s+)?time\b|\bself[\s-]?serv(?:ice|icing)\b|\bschedule\s+online\b/i;

const TRAILING_LINK_ANCHOR_RE = /(?:here|below|link)\s*:\s*$/i;

/** Detect outbound copy that offers self-scheduling without a deliverable URL. */
export function isBrokenSelfSchedulingOutbound(
  text: string,
  calendarLinkAllowed: boolean,
): boolean {
  if (calendarLinkAllowed || !text.trim()) {
    return false;
  }
  if (/https?:\/\//.test(text)) {
    return false;
  }
  if (UNAUTHORIZED_SELF_SCHEDULE_COPY_RE.test(text) && TRAILING_LINK_ANCHOR_RE.test(text.trim())) {
    return true;
  }
  return UNAUTHORIZED_SELF_SCHEDULE_COPY_RE.test(text);
}

export function calendarLinkFallbackMessage(context: AnyConversationContext): string {
  return `If it's easier, you can grab a time here: ${context.bookingUrl}`;
}

export function genericRecoveryMessage(_context: AnyConversationContext): string {
  return "Chris with 624Voice — I hit a snag on my side. Mind sending that again?";
}

/**
 * Finalize outbound SMS calendar-link handling.
 * Returns null when the entire reply must be rejected (never send dangling self-sched copy).
 */
export function finalizeCalendarLinkOutbound(
  reply: string,
  context: AnyConversationContext,
  calendarLinkAllowed = false,
): string | null {
  if (!reply.trim()) {
    return null;
  }
  if (calendarLinkAllowed) {
    return reply.trim();
  }

  let sanitized = reply.replace(/https?:\/\/[^\s]+/g, "").replace(/\s{2,}/g, " ").trim();
  if (context.bookingUrl && sanitized.includes(context.bookingUrl)) {
    sanitized = sanitized.replace(context.bookingUrl, "").replace(/\s{2,}/g, " ").trim();
  }

  if (isBrokenSelfSchedulingOutbound(sanitized, false)) {
    return null;
  }
  if (UNAUTHORIZED_SELF_SCHEDULE_COPY_RE.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/** @deprecated Prefer finalizeCalendarLinkOutbound — rejects broken copy instead of sanitizing URLs only. */
export function blockPrematureCalendarLink(
  reply: string,
  context: AnyConversationContext,
  calendarLinkAllowed = false,
): string {
  return finalizeCalendarLinkOutbound(reply, context, calendarLinkAllowed) ?? "";
}

export function llmUnavailableFallbackMessage(context: AnyConversationContext): string {
  return genericRecoveryMessage(context);
}
