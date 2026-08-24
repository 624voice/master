import { bookingConfirmationMessage } from "~/server/appointmentLifecycle/messages";
import { formatNaturalTime } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { SPEED2LEAD_LLM_MAX_SMS_LENGTH } from "~/server/speed2Lead/config";
import {
  resolveLlmTurnTask,
  shouldSendDeterministicSchedulingAsk,
} from "~/server/speed2Lead/conversationStage";
import { containsUnsupportedProductClaim, containsAiAsPrimaryBenefit } from "~/server/speed2Lead/businessContext";
import { isMeetingInterestConfirmed } from "~/server/speed2Lead/meetingInterest";
import {
  isDiscoveryComplete,
  isReportReactionComplete,
} from "~/server/speed2Lead/discoveryProgress";
import {
  containsDisallowedBotTerminology,
  containsDisallowedProspectName,
  containsUnauthorizedCalendarUrl,
  countGenuineQuestions,
  violatesBridgeSchedulingSeparation,
} from "~/server/speed2Lead/outboundPolicy";
import {
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
} from "~/server/speed2Lead/schedulingContext";
import { schedulingFactsComplete } from "~/server/speed2Lead/schedulingIntent";
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
  calendarLinkAllowed?: boolean;
  allowProspectName?: boolean;
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
  /\b(confirm you want|before i can book|lock that in|need you to confirm|should i book|want me to grab|want me to book|do you want me to (?:book|grab|lock))\b/i;
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

  if (containsUnsupportedProductClaim(trimmed)) {
    return { ok: false, reason: "SMS claims an unsupported 624Voice capability" };
  }

  if (
    containsAiAsPrimaryBenefit(trimmed) &&
    resolveLlmTurnTask(ctx.session, "").task === "ask_conditional_meeting_bridge"
  ) {
    return { ok: false, reason: "SMS sells AI as the primary meeting benefit instead of business outcome" };
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

  if (containsUnauthorizedCalendarUrl(trimmed, ctx.calendarLinkAllowed ?? false)) {
    return { ok: false, reason: "SMS contains an unauthorized calendar link" };
  }

  if (containsDisallowedBotTerminology(trimmed)) {
    return { ok: false, reason: "SMS uses disallowed bot terminology" };
  }

  if (
    isMeetingInterestConfirmed(ctx.session.knownFacts) &&
    /\b(before we lock in|diagnostic|which part stood out|during your busiest hours|specific moment)\b/i.test(
      trimmed,
    )
  ) {
    return { ok: false, reason: "SMS asks discovery after meeting interest confirmed" };
  }

  if (countGenuineQuestions(trimmed) > 1) {
    return { ok: false, reason: "SMS contains more than one question" };
  }

  const stagePlan = resolveLlmTurnTask(ctx.session, "");
  if (
    violatesBridgeSchedulingSeparation({
      text: trimmed,
      stage: stagePlan.stage,
      task: stagePlan.task,
    })
  ) {
    return { ok: false, reason: "SMS combines meeting bridge and scheduling asks" };
  }

  const allowName =
    ctx.allowProspectName ??
    (ctx.session.scheduling?.status === "confirmed" &&
      ctx.toolState.bookingConfirmed === true);
  if (containsDisallowedProspectName(trimmed, ctx.session, allowName)) {
    return { ok: false, reason: "SMS uses prospect name outside allowed turns" };
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
    meetingLink?: string;
  } = {},
): string {
  if (options.useLifecycleCopy) {
    return "";
  }

  return bookingConfirmationMessage({
    firstName,
    appointmentStart: start,
    timezone: CONSULTATION_TIMEZONE,
    meetingLink: options.meetingLink,
  });
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

export function genericRecoveryMessage(context: AnyConversationContext): string {
  if (context.scheduling?.status === "confirmed" || context.disposition === "booked") {
    return "You're all set — reach out anytime if anything comes up before the call.";
  }

  if (
    context.scheduling?.centralDate ||
    context.scheduling?.partOfDay ||
    (context.scheduling?.offeredSlots?.length ?? 0) > 0
  ) {
    return "Still here — go ahead with your timing preference when you're ready.";
  }

  const stagePlan = resolveLlmTurnTask(context, "");
  if (stagePlan.stage === "meeting_bridge" || isDiscoveryComplete(context)) {
    return "Still with you — worth a quick 25-minute look at how we could help with that?";
  }
  if (!isReportReactionComplete(context)) {
    return "Still here — what part of the report stood out most for you?";
  }
  return "Still here — go ahead when you're ready.";
}

export function buildProviderUnavailableRecoveryMessage(
  context: AnyConversationContext,
  calendarLinkAllowed: boolean,
): string {
  if (calendarLinkAllowed) {
    return calendarLinkFallbackMessage(context);
  }
  if (schedulingFactsComplete(context.scheduling)) {
    return "I'm having trouble pulling my calendar up right now — I still have your timing noted.";
  }
  if (hasKnownSchedulingDay(context.scheduling)) {
    return "I'm having trouble pulling my calendar up right now — I still have your timing noted.";
  }
  return "I'm having trouble pulling my calendar up right now — what day works best for a quick 25-minute chat?";
}

export function buildStageAwareRecoveryMessage(
  context: AnyConversationContext,
  calendarLinkAllowed = false,
): string {
  if (shouldSendDeterministicSchedulingAsk(context, "")) {
    return "What day works best for a quick 25-minute chat?";
  }
  return genericRecoveryMessage(context);
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
