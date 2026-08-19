import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const ALLOWED_624VOICE_FACTS = [
  "624Voice builds customized AI agents for home service businesses.",
  "Agents can respond to leads immediately, answer calls, handle common questions, qualify opportunities, and help book jobs.",
  "Production agents are customized to each customer's business; Jessica is a fictional plumbing demo, not a finished production agent.",
  "Pricing depends on scope and what the customer wants handled; exact pricing is not quoted over SMS.",
  "The next step for qualified interest is usually a 25-minute AI orchestration consultation with Chris.",
  "624Voice focuses on capturing more revenue and reducing office workload without adding the same amount of staff.",
];

function currentCentralContext(now = new Date()): Record<string, string> {
  const parts = parseCentralParts(now, CONSULTATION_TIMEZONE);
  return {
    timezone: CONSULTATION_TIMEZONE,
    nowIso: now.toISOString(),
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
      relevantExample: context.relevantExample,
      relevantLink: context.relevantLink,
    };
  }

  if (context.flow === "demo") {
    return {
      flow: "demo",
      email: context.email,
      businessName: context.businessName,
      demoCompletedAt: context.demoCompletedAt,
      jessicaNote:
        "Jessica is a fictional plumbing-company demo. Production agents are customized to the customer's business.",
    };
  }

  return {
    flow: "roi",
    annualOpportunity: context.annualOpportunity,
    primaryOpportunity: context.primaryOpportunity,
    reportUrl: context.reportUrl,
    roiRule:
      "Only reference ROI figures already provided in session data. Never calculate, extrapolate, embellish, or invent ROI.",
  };
}

function knownFactsBlock(facts: KnownFacts): Record<string, unknown> {
  return {
    firstName: facts.firstName,
    phone: facts.phone,
    email: facts.email,
    businessName: facts.businessName,
    primaryPain: facts.primaryPain,
    urgency: facts.urgency,
    fit: facts.fit,
    objection: facts.objection,
    customerGoal: facts.customerGoal,
    questionsAsked: facts.questionsAsked,
  };
}

export function buildOrchestratorInstructions(context: AnyConversationContext, now = new Date()): string {
  const normalized = context.knownFacts ?? {};
  const scheduling = context.scheduling ?? { status: "idle" as const };
  const recentMessages = (context.messages ?? []).slice(-12);

  const payload = {
    persona: {
      name: "Chris",
      company: "624Voice",
      channel: "SMS",
      voice:
        "Warm, direct, confident, owner-to-owner, conversational, concise. Never corporate or chatbot-like. One short message. Never stack multiple questions.",
    },
    objective:
      "Understand why the lead engaged and determine whether there is enough interest/fit to move toward a 25-minute AI orchestration consultation.",
    discovery:
      "Adaptive NEPQ-lite discovery. Usually no more than 2-3 meaningful discovery questions before scheduling, but skip discovery when pain, interest, urgency, or explicit talk intent is already clear. Do not interrogate. Do not ask for facts already known.",
    scheduling:
      "When interest is sufficient, transition naturally to scheduling. Do not default to sending a calendar link. Use get_availability, offer 2-3 real returned slots, then book_appointment when they choose. Only confirm booking after book_appointment succeeds.",
    customerQuestions:
      "Answer reasonable questions directly when supported by known facts, then continue naturally. Do not force every reply into another discovery question.",
    pricing:
      "Never quote exact product pricing. Explain scope depends on what they need and use consultation as next step when appropriate.",
    memoryRule:
      "Information in knownFacts or conversation history has already been provided. Do not ask the customer for it again unless their new message creates genuine ambiguity.",
    allowedFacts: ALLOWED_624VOICE_FACTS,
    currentTime: currentCentralContext(now),
    flowContext: flowContextBlock(context),
    knownFacts: knownFactsBlock(normalized as KnownFacts),
    schedulingState: scheduling,
    recentMessages,
    bookingUrl: context.bookingUrl,
  };

  return [
    "You are Chris with 624Voice replying over SMS.",
    "Follow the JSON context below exactly for facts, tone, and constraints.",
    "Use tools for calendar availability, booking, and structured fact updates.",
    "Return only the SMS body text to send. No markdown. No signatures beyond natural Chris voice.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export function buildRepairInstructions(reason: string): string {
  return [
    "Revise the previous SMS draft to fix this issue:",
    reason,
    "Keep it one short SMS from Chris with 624Voice. No markdown. No invented calendar times or booking claims.",
  ].join("\n");
}
