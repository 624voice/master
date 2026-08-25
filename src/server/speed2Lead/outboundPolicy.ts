import type { LlmTurnTask, RoiConversationStage } from "~/server/speed2Lead/conversationStage";
import {
  containsBridgeLanguage,
  containsSchedulingAskLanguage,
} from "~/server/speed2Lead/conversationStage";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const BOT_TERMINOLOGY_RE = /\b(ai\s+bots?|chatbots?)\b/i;
const URL_RE = /https?:\/\/[^\s]+/g;

export type OutboundLinkKind = "BOOKED_MEETING_LINK" | "BOOKING_FALLBACK_LINK" | "UNAUTHORIZED_URL";

/** Count customer-facing questions, ignoring URLs and quoted spans. */
export function countGenuineQuestions(text: string): number {
  let cleaned = text.replace(/https?:\/\/[^\s]+/g, " ");
  cleaned = cleaned.replace(/"[^"]*"/g, " ").replace(/'[^']*'/g, " ");
  return (cleaned.match(/\?/g) ?? []).length;
}

export function containsDisallowedBotTerminology(text: string): boolean {
  return BOT_TERMINOLOGY_RE.test(text);
}

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

/** Persisted provider-generated Google Meet URL from a confirmed booking. */
export function isBookedMeetingLink(url: string, context?: AnyConversationContext): boolean {
  const persisted = context?.scheduling?.googleMeetUrl?.trim();
  if (persisted && url.startsWith(persisted)) {
    return true;
  }
  if (context?.scheduling?.status === "confirmed" && /^https:\/\/meet\.google\.com\//i.test(url)) {
    return true;
  }
  return false;
}

/** Generic self-schedule / calendar fallback URL — not an authorized booked Meet link. */
export function isBookingFallbackLink(url: string, context?: AnyConversationContext): boolean {
  const bookingUrl = context?.bookingUrl?.trim();
  if (bookingUrl && url.startsWith(bookingUrl)) {
    return true;
  }
  return /calendar\.app\.google/i.test(url);
}

export function classifyOutboundUrl(
  url: string,
  context?: AnyConversationContext,
): OutboundLinkKind {
  if (isBookedMeetingLink(url, context)) {
    return "BOOKED_MEETING_LINK";
  }
  if (isBookingFallbackLink(url, context)) {
    return "BOOKING_FALLBACK_LINK";
  }
  return "UNAUTHORIZED_URL";
}

export function containsUnauthorizedCalendarUrl(
  text: string,
  calendarLinkAllowed: boolean,
  context?: AnyConversationContext,
): boolean {
  if (calendarLinkAllowed) return false;
  return extractUrls(text).some((url) => classifyOutboundUrl(url, context) !== "BOOKED_MEETING_LINK");
}

export function containsDisallowedProspectName(
  text: string,
  context: AnyConversationContext,
  allowName: boolean,
): boolean {
  if (allowName || !context.firstName?.trim()) return false;
  const escaped = context.firstName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function violatesBridgeSchedulingSeparation(args: {
  text: string;
  stage: RoiConversationStage;
  task: LlmTurnTask;
}): boolean {
  if (args.stage !== "meeting_bridge" && args.task !== "ask_conditional_meeting_bridge") {
    return false;
  }
  return containsBridgeLanguage(args.text) && containsSchedulingAskLanguage(args.text);
}

export function violatesOneQuestionRule(text: string): boolean {
  return countGenuineQuestions(text) > 1;
}
