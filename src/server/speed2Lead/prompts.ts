import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { allowedFactsForPrompt, businessContextForPrompt } from "~/server/speed2Lead/businessContext";
import {
  resolveLlmTurnTask,
  type LlmTurnTask,
} from "~/server/speed2Lead/conversationStage";
import { normalizeDiscoveryFacts } from "~/server/speed2Lead/discoveryProgress";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const TASK_GUIDANCE: Record<LlmTurnTask, string> = {
  acknowledge_report_reaction_and_ask_one_operational_question:
    "Acknowledge their reaction to the ROI report. Ask ONE diagnostic question tied to what they flagged and a problem 624Voice can help with.",
  ask_one_operational_followup:
    "Acknowledge what they said. Ask ONE diagnostic follow-up only if relevance to 624Voice is still unclear. Do not restart discovery.",
  ask_conditional_meeting_bridge:
    "Acknowledge their situation. Ask ONE low-pressure conditional question about a 25-minute walkthrough — do not ask what day or time works.",
  answer_customer_question:
    "Answer their question briefly using allowedFacts and businessContext. Do not mention calendar times, availability, or booking.",
  brief_active_conversation:
    "Reply briefly and naturally. Do not ask scheduling questions or offer times.",
};

function currentCentralContext(now = new Date()): Record<string, string> {
  const parts = parseCentralParts(now, CONSULTATION_TIMEZONE);
  return {
    timezone: CONSULTATION_TIMEZONE,
    todayCentralDate: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    weekday: parts.weekday,
    localTime: `${parts.hour}:${String(parts.minute).padStart(2, "0")}`,
  };
}

function flowContextBlock(context: AnyConversationContext): Record<string, unknown> {
  if (context.flow === "contact") {
    return {
      flow: "contact",
      shortNeedSummary: context.shortNeedSummary,
      relevantSolution: context.relevantSolution,
    };
  }
  if (context.flow === "demo") {
    return {
      flow: "demo",
      email: context.email,
      businessName: context.businessName,
    };
  }
  return {
    flow: "roi",
    annualOpportunity: context.annualOpportunity,
    primaryOpportunity: context.primaryOpportunity,
  };
}

function knownFactsBlock(facts: KnownFacts): Record<string, unknown> {
  const normalized = normalizeDiscoveryFacts(facts);
  return {
    businessName: normalized.businessName,
    primaryPain: normalized.primaryPain,
    urgency: normalized.urgency,
    fit: normalized.fit,
    customerGoal: normalized.customerGoal,
    discoveryPhase: normalized.discoveryPhase,
    diagnosticQuestionsAsked: normalized.diagnosticQuestionsAsked,
  };
}

function dispositionLabel(context: AnyConversationContext): string {
  const disposition = context.disposition ?? "active";
  if (disposition === "booked") return "booked";
  if (disposition === "soft_closed") return "soft_closed";
  if (disposition === "declined") return "declined";
  return "active";
}

export function buildOrchestratorInstructions(
  context: AnyConversationContext,
  now = new Date(),
  inboundMessage = "",
): string {
  const stagePlan = resolveLlmTurnTask(context, inboundMessage);
  const payload = {
    persona:
      "Chris with 624Voice. Direct, practical, concise — operator-to-operator SMS for home-services owners. Natural, not corporate. One short message. At most one question.",
    task: stagePlan.task,
    taskGuidance: TASK_GUIDANCE[stagePlan.task],
    stage: stagePlan.stage,
    businessContext: businessContextForPrompt(),
    memory: "Do not re-ask knownFacts or repeat prior questions unless new ambiguity.",
    allowedFacts: allowedFactsForPrompt(),
    terminology:
      "Say AI or using AI when describing the product. Do not say bots, AI bots, orchestration, or internal jargon.",
    disposition: dispositionLabel(context),
    currentTime: currentCentralContext(now),
    flowContext: flowContextBlock(context),
    knownFacts: knownFactsBlock(context.knownFacts ?? ({} as KnownFacts)),
  };

  return [
    "You are Chris with 624Voice replying over SMS.",
    "Follow the JSON context for this turn only.",
    "Return only the SMS body. No markdown. No calendar times, bookings, or links.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export function buildRepairInstructions(reason: string): string {
  return [
    "Revise the previous SMS draft to fix this issue:",
    reason,
    "Keep it one short SMS from Chris with 624Voice. No markdown.",
    "At most one question. No calendar times, bookings, or links.",
  ].join("\n");
}

export function buildOneQuestionRepairInstructions(): string {
  return buildRepairInstructions(
    "The message must contain at most one genuine question. Remove extra questions.",
  );
}

export function buildBridgeRepairInstructions(): string {
  return buildRepairInstructions(
    "Ask only the meeting bridge question. Do not ask what day or time works in the same message.",
  );
}

export function buildTerminologyRepairInstructions(): string {
  return buildRepairInstructions('Use "AI" or "using AI" — do not say bots or AI bots.');
}

export function buildUnsupportedProductClaimRepairInstructions(): string {
  return buildRepairInstructions(
    "624Voice prevents opportunities from falling through the cracks by responding and taking action. It is not missed-call analytics, reporting, or a dashboard that merely flags calls.",
  );
}
