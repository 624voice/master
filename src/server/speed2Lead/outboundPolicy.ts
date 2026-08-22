import type { LlmTurnTask, RoiConversationStage } from "~/server/speed2Lead/conversationStage";
import {
  containsBridgeLanguage,
  containsSchedulingAskLanguage,
} from "~/server/speed2Lead/conversationStage";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const BOT_TERMINOLOGY_RE = /\b(ai\s+bots?|chatbots?)\b/i;
const UNAUTHORIZED_URL_RE = /https?:\/\//;

/** Count customer-facing questions, ignoring URLs and quoted spans. */
export function countGenuineQuestions(text: string): number {
  let cleaned = text.replace(/https?:\/\/[^\s]+/g, " ");
  cleaned = cleaned.replace(/"[^"]*"/g, " ").replace(/'[^']*'/g, " ");
  return (cleaned.match(/\?/g) ?? []).length;
}

export function containsDisallowedBotTerminology(text: string): boolean {
  return BOT_TERMINOLOGY_RE.test(text);
}

export function containsUnauthorizedCalendarUrl(
  text: string,
  calendarLinkAllowed: boolean,
): boolean {
  if (calendarLinkAllowed) return false;
  return UNAUTHORIZED_URL_RE.test(text);
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
