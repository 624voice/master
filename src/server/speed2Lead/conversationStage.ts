import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  detectExplicitSchedulingRequest,
  detectMeetingBridgeAgreement,
  shouldRequireMeetingBridge,
} from "~/server/speed2Lead/conversationHandoff";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type RoiConversationStage =
  | "report_reaction"
  | "operational_followup"
  | "meeting_bridge"
  | "scheduling"
  | "booked"
  | "soft_closed";

export type LlmTurnTask =
  | "acknowledge_report_reaction_and_ask_one_operational_question"
  | "ask_one_operational_followup"
  | "ask_conditional_meeting_bridge"
  | "answer_customer_question"
  | "brief_active_conversation";

export type ConversationStagePlan = {
  stage: RoiConversationStage;
  task: LlmTurnTask;
  /** Code sends the scheduling preference ask on this turn — LLM must not. */
  deterministicSchedulingAsk?: boolean;
};

const SCHEDULING_ASK_RE =
  /\b(what day|which day|morning or afternoon|when works|what time|what times|schedule a|grab a time|pick a time|find a time|set up a (?:call|time))\b/i;

function painKnown(context: AnyConversationContext, facts: KnownFacts): boolean {
  return Boolean(facts.primaryPain || (context.detectedPains?.length ?? 0) > 0);
}

function userMessageCount(context: AnyConversationContext): number {
  return (context.messages ?? []).filter((message) => message.role === "user").length;
}

export function resolveRoiConversationStage(context: AnyConversationContext): RoiConversationStage {
  const disposition = context.disposition ?? "active";
  if (disposition === "soft_closed") return "soft_closed";
  if (disposition === "booked" || context.scheduling?.status === "confirmed") return "booked";
  if (
    context.knownFacts?.meetingBridgeComplete ||
    context.scheduling?.status === "slots_offered" ||
    hasActiveScheduling(context)
  ) {
    return "scheduling";
  }
  const facts = context.knownFacts ?? {
    firstName: context.firstName,
    phone: context.phone,
    flow: "roi" as const,
    questionsAsked: 0,
  };
  if (shouldRequireMeetingBridge(context, "")) return "meeting_bridge";
  if ((facts.questionsAsked ?? 0) >= 1 && painKnown(context, facts)) return "meeting_bridge";
  if (userMessageCount(context) >= 1) return "operational_followup";
  return "report_reaction";
}

function hasActiveScheduling(context: AnyConversationContext): boolean {
  const scheduling = context.scheduling;
  if (!scheduling) return false;
  return Boolean(
    scheduling.centralDate ||
      scheduling.partOfDay ||
      scheduling.anchorTimeMinutes != null ||
      scheduling.status !== "idle",
  );
}

export function resolveLlmTurnTask(
  context: AnyConversationContext,
  inboundMessage: string,
): ConversationStagePlan {
  const stage = resolveRoiConversationStage(context);
  const signals = analyzeMessage(inboundMessage);

  if (stage === "soft_closed") {
    return { stage, task: "brief_active_conversation" };
  }
  if (stage === "booked") {
    return { stage, task: "brief_active_conversation" };
  }
  if (stage === "scheduling") {
    return { stage, task: "brief_active_conversation" };
  }
  if (stage === "meeting_bridge") {
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage, task: "answer_customer_question" };
    }
    return { stage, task: "ask_conditional_meeting_bridge" };
  }
  if (stage === "operational_followup") {
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage, task: "answer_customer_question" };
    }
    return { stage, task: "ask_one_operational_followup" };
  }
  return { stage, task: "acknowledge_report_reaction_and_ask_one_operational_question" };
}

/** After bridge agreement, code owns the first scheduling question on the same turn. */
export function shouldSendDeterministicSchedulingAsk(
  context: AnyConversationContext,
  inboundMessage: string,
): boolean {
  if (context.flow !== "roi") return false;
  if (context.disposition === "soft_closed" || context.disposition === "declined") return false;
  if (context.scheduling?.status === "confirmed") return false;
  if (context.scheduling?.status === "slots_offered") return false;
  if ((context.scheduling?.offeredSlots?.length ?? 0) > 0) return false;
  if (!context.knownFacts?.meetingBridgeComplete) return false;
  if (detectExplicitSchedulingRequest(inboundMessage)) return false;
  if (SCHEDULING_ASK_RE.test(inboundMessage)) return false;
  return detectMeetingBridgeAgreement(inboundMessage);
}

export function containsSchedulingAskLanguage(text: string): boolean {
  return SCHEDULING_ASK_RE.test(text);
}

export function containsBridgeLanguage(text: string): boolean {
  return /\b(25[\s-]?min(?:ute)?s?|quick (?:look|chat|walkthrough)|worth a look|open to (?:it|a)|make sense to (?:talk|look|walk)|walk through)\b/i.test(
    text,
  );
}
