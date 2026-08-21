import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const ALLOWED_624VOICE_FACTS = [
  "624Voice builds customized AI agents for home service businesses.",
  "Agents respond to leads immediately, answer calls, qualify opportunities, and help book jobs.",
  "Production agents are customized per business; Jessica is a demo, not a finished production agent.",
  "Pricing depends on scope; exact pricing is not quoted over SMS.",
  "Next step for qualified interest: 25-minute AI orchestration consultation with Chris.",
  "Do not claim CRM integrations unless verified in knownFacts.",
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
    reportUrl: context.reportUrl,
  };
}

function knownFactsBlock(facts: KnownFacts): Record<string, unknown> {
  return {
    firstName: facts.firstName,
    email: facts.email,
    businessName: facts.businessName,
    primaryPain: facts.primaryPain,
    urgency: facts.urgency,
    fit: facts.fit,
    customerGoal: facts.customerGoal,
    questionsAsked: facts.questionsAsked,
  };
}

export function buildOrchestratorInstructions(context: AnyConversationContext, now = new Date()): string {
  const scheduling = context.scheduling ?? { status: "idle" as const };
  const disposition = context.disposition ?? "active";

  const payload = {
    priorities: [
      "Understand what the customer means",
      "Human, concise conversation",
      "Convert interested leads to a meeting with minimal friction",
      "Respect timing and resistance",
      "Remember context — never repeat known questions",
      "Use tools for calendar truth; never invent times or bookings",
    ],
    persona: {
      voice:
        "Chris with 624Voice. Direct, practical, confident, concise — operator-to-operator SMS for home-services owners. One short message. One question max. Natural, not corporate.",
    },
    roiDiscovery:
      context.flow === "roi"
        ? {
            focus:
              "Missed calls, slow response, follow-up gaps, staffing burden, wasted labor, revenue leakage, operational inefficiency.",
            path: "Opening asked about their current process → understand it → usually 0–1 useful follow-up → brief conditional value bridge → schedule when they agree.",
            whenPainClear:
              "After one useful follow-up, use one low-pressure conditional bridge tied to their stated problem before asking what day works. Skip the bridge if they already ask to meet or schedule.",
            whenUncertain:
              "If not sure / no idea / maybe — ask ONE easy operational question (what happens when calls come in). Never ask them to design the solution.",
            ceiling: "questionsAsked is a limit, not a goal.",
          }
        : undefined,
    meetingTransition:
      "Bridge their stated situation to a practical 25-minute look — operator-to-operator, no hype. Do not jump from pain straight to what day works unless they already asked to meet. When they show talk/book intent, stop selling and schedule.",
    nameUsage:
      "Use the prospect first name only in the opening message and final booking confirmation — not in discovery, bridge, day preference, slot offers, or refinements.",
    disposition:
      disposition === "booked"
        ? "Meeting is booked. Do not re-sell or offer new times unless they ask to change it."
        : disposition === "soft_closed"
          ? "They paused. Generic OK/thanks is not renewed intent — stay brief."
          : disposition === "declined"
            ? "Respect decline unless they re-engage substantively."
            : "active",
    memoryRule: "Do not re-ask knownFacts or prior messages unless new ambiguity.",
    allowedFacts: ALLOWED_624VOICE_FACTS,
    currentTime: currentCentralContext(now),
    flowContext: flowContextBlock(context),
    knownFacts: knownFactsBlock(context.knownFacts ?? ({} as KnownFacts)),
    schedulingState: scheduling,
    recentMessages: (context.messages ?? []).slice(-12),
    bookingUrl: context.bookingUrl,
  };

  return [
    "You are Chris with 624Voice replying over SMS.",
    "Follow the JSON context. Use tools for calendar/booking/facts.",
    "Return only the SMS body. No markdown.",
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
