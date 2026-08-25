import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  detectExplicitSchedulingRequest,
  detectMeetingBridgeAgreement,
  meetingBridgeQuestionDelivered,
} from "~/server/speed2Lead/conversationHandoff";
import {
  isDiscoveryComplete,
  isReportReactionComplete,
  normalizeDiscoveryFacts,
  shouldAskAnotherDiagnosticQuestion,
} from "~/server/speed2Lead/discoveryProgress";
import { isMeetingInterestConfirmed } from "~/server/speed2Lead/meetingInterest";
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

const OPERATIONAL_QUESTION_RE =
  /\b(process now|when a new lead|call them back|get back|respond|handling calls|current process|slip through)\b/i;

function factsFor(context: AnyConversationContext): KnownFacts {
  return normalizeDiscoveryFacts(
    context.knownFacts ?? {
      firstName: context.firstName,
      phone: context.phone,
      flow: "roi" as const,
      questionsAsked: 0,
    },
  );
}

function painKnown(facts: KnownFacts): boolean {
  return Boolean(facts.primaryPain);
}

function userMessageCount(context: AnyConversationContext): number {
  return (context.messages ?? []).filter((message) => message.role === "user").length;
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

export function resolveRoiConversationStage(context: AnyConversationContext): RoiConversationStage {
  const disposition = context.disposition ?? "active";
  if (disposition === "soft_closed") return "soft_closed";
  if (disposition === "booked" || context.scheduling?.status === "confirmed") return "booked";

  const facts = factsFor(context);
  const phase = facts.discoveryPhase ?? "awaiting_report_reaction";

  if (
    isMeetingInterestConfirmed(facts) ||
    phase === "scheduling" ||
    context.scheduling?.status === "slots_offered" ||
    hasActiveScheduling(context) ||
    detectExplicitSchedulingRequest(context.lastCustomerMessage ?? "")
  ) {
    return "scheduling";
  }

  if (phase === "bridge" || phase === "discovery_complete" || (painKnown(facts) && isDiscoveryComplete(context))) {
    return "meeting_bridge";
  }

  if (userMessageCount(context) >= 1 || phase !== "awaiting_report_reaction") {
    return "operational_followup";
  }

  return "report_reaction";
}

export function resolveLlmTurnTask(
  context: AnyConversationContext,
  inboundMessage: string,
): ConversationStagePlan {
  const stage = resolveRoiConversationStage(context);
  const signals = analyzeMessage(inboundMessage);
  const facts = factsFor(context);

  if (isMeetingInterestConfirmed(facts)) {
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage: "scheduling", task: "answer_customer_question" };
    }
    return { stage: "scheduling", task: "brief_active_conversation" };
  }

  if (stage === "soft_closed") {
    return { stage, task: "brief_active_conversation" };
  }
  if (stage === "booked") {
    return { stage, task: "brief_active_conversation" };
  }
  if (stage === "scheduling") {
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage: "scheduling", task: "answer_customer_question" };
    }
    return { stage: "scheduling", task: "brief_active_conversation" };
  }
  if (stage === "meeting_bridge") {
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage, task: "answer_customer_question" };
    }
    return { stage, task: "ask_conditional_meeting_bridge" };
  }
  if (stage === "operational_followup") {
    if (isDiscoveryComplete(context)) {
      return { stage: "meeting_bridge", task: "ask_conditional_meeting_bridge" };
    }
    if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) {
      return { stage, task: "answer_customer_question" };
    }
    if (!shouldAskAnotherDiagnosticQuestion(context)) {
      return { stage: "meeting_bridge", task: "ask_conditional_meeting_bridge" };
    }
    if (isReportReactionComplete(context)) {
      return { stage, task: "ask_one_operational_followup" };
    }
    return { stage, task: "acknowledge_report_reaction_and_ask_one_operational_question" };
  }
  return { stage, task: "acknowledge_report_reaction_and_ask_one_operational_question" };
}

/** Code-level invariant: discovery tasks are illegal after meeting interest is confirmed. */
export function isDiscoveryTaskBlocked(context: AnyConversationContext, task: LlmTurnTask): boolean {
  if (!isMeetingInterestConfirmed(context.knownFacts)) return false;
  return (
    task === "ask_one_operational_followup" ||
    task === "acknowledge_report_reaction_and_ask_one_operational_question"
  );
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
  if (!isMeetingInterestConfirmed(context.knownFacts)) return false;
  if (detectExplicitSchedulingRequest(inboundMessage)) return false;
  if (SCHEDULING_ASK_RE.test(inboundMessage)) return false;
  if (hasActiveScheduling(context)) return false;

  if (meetingBridgeQuestionDelivered(context) && detectMeetingBridgeAgreement(inboundMessage)) {
    return true;
  }

  if (
    !meetingBridgeQuestionDelivered(context) &&
    inboundMessage.trim().length > 0 &&
    !detectMeetingBridgeAgreement(inboundMessage)
  ) {
    const lastAssistant = [...(context.messages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    if (lastAssistant && OPERATIONAL_QUESTION_RE.test(lastAssistant.content)) {
      return true;
    }
  }

  if (
    context.scheduling?.lastBlockedFallback &&
    isMeetingInterestConfirmed(context.knownFacts) &&
    inboundMessage.trim().length > 0
  ) {
    return true;
  }

  return false;
}

export function containsSchedulingAskLanguage(text: string): boolean {
  return SCHEDULING_ASK_RE.test(text);
}

export function containsBridgeLanguage(text: string): boolean {
  return /\b(25[\s-]?min(?:ute)?s?|quick (?:look|chat|walkthrough)|worth a look|open to (?:it|a)|make sense to (?:talk|look|walk)|walk through)\b/i.test(
    text,
  );
}
