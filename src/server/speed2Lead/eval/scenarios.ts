import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import type { ScenarioExpectations } from "~/server/speed2Lead/eval/scoring";
import { initialMessage as contactOpening } from "~/server/contactSpeed2Lead/messages";
import { initialMessage as demoOpening } from "~/server/demoSpeed2Lead/messages";
import { initialMessage as roiOpening } from "~/server/speed2Lead/messages";
import type { AnyConversationContext, ConversationContext } from "~/server/speed2Lead/types";

export type LiveEvalScenario = {
  id: string;
  category: "roi" | "contact" | "demo" | "scheduling" | "edge";
  name: string;
  phone: string;
  buildSession: (now: Date) => AnyConversationContext;
  openingMessage?: (session: AnyConversationContext) => string;
  customerTurns: string[];
  expectations: ScenarioExpectations;
  calendarMode?: "ok" | "unconfigured" | "slot_conflict";
  presetSlots?: (now: Date) => string[];
};

const TZ = CONSULTATION_TIMEZONE;
const BOOKING = "https://calendar.app.google/eval-test";

function evalPhone(suffix: string): string {
  return `+1555999${suffix.padStart(4, "0")}`;
}

function baseKnownFacts(session: AnyConversationContext) {
  return session.knownFacts ?? { questionsAsked: 0 };
}

export function buildRoiSession(now: Date, phone: string, overrides: Partial<ConversationContext> = {}): ConversationContext {
  const session: ConversationContext = {
    flow: "roi",
    phone,
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/eval",
    bookingUrl: BOOKING,
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone,
      flow: "roi",
      businessName: "Test Plumbing",
      customerGoal: "Missed calls",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
  return session;
}

export function buildContactSession(
  now: Date,
  phone: string,
  overrides: Partial<ContactConversationContext> = {},
): ContactConversationContext {
  return {
    flow: "contact",
    phone,
    firstName: "Sam",
    businessName: "Sam HVAC",
    shortNeedSummary: "We miss calls after hours and need faster lead response",
    relevantSolution: "AI lead response and scheduling",
    relevantLink: "https://624voice.com/services",
    relevantExample: "https://624voice.com/book",
    bookingUrl: BOOKING,
    state: "awaiting_prompt",
    messages: [],
    knownFacts: {
      firstName: "Sam",
      phone,
      flow: "contact",
      businessName: "Sam HVAC",
      customerGoal: "We miss calls after hours and need faster lead response",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

export function buildDemoSession(
  now: Date,
  phone: string,
  overrides: Partial<DemoConversationContext> = {},
): DemoConversationContext {
  return {
    flow: "demo",
    phone,
    firstName: "Jamie",
    lastName: "Lee",
    email: "jamie@eval.test",
    businessName: "Lee Plumbing",
    hasWebsite: true,
    smsConsent: true,
    demoCompleted: true,
    demoCompletedAt: now.toISOString(),
    bookingUrl: BOOKING,
    state: "awaiting_fit",
    messages: [],
    knownFacts: {
      firstName: "Jamie",
      phone,
      email: "jamie@eval.test",
      flow: "demo",
      businessName: "Lee Plumbing",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

export function slotsForWeekday(
  now: Date,
  weekday: "Mon" | "Tue" | "Wed" | "Thu" | "Fri",
  hours: number[],
): string[] {
  let candidate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 21; i++) {
    const parts = parseCentralParts(candidate, TZ);
    if (parts.weekday === weekday) {
      return hours.map((hour) =>
        centralDateAt(parts.year, parts.month, parts.day, hour, 0, TZ).toISOString(),
      );
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  throw new Error(`No ${weekday} found within 21 days`);
}

export function tuesdayAfternoonSlots(now: Date): string[] {
  return slotsForWeekday(now, "Tue", [13, 14, 16]).map((iso, i) => {
    if (i === 1) return iso;
    return iso;
  });
}

export const LIVE_EVAL_SCENARIOS: LiveEvalScenario[] = [
  {
    id: "roi-discovery-full",
    category: "roi",
    name: "ROI normal discovery through slots",
    phone: evalPhone("0001"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0001")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "We miss a lot of calls after hours",
      "Yeah it's a real problem for us",
      "I'd like to talk through what you would do",
      "Tuesday afternoon works",
    ],
    expectations: {
      mustNotRepeatPainQuestion: true,
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      customerGoalKeywords: ["miss", "call", "after hours"],
      maxQuestionsPerTurn: 1,
    },
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "roi-fast-conversion",
    category: "roi",
    name: "ROI fast conversion to scheduling",
    phone: evalPhone("0002"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0002")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["I'd like to talk with someone about this", "Tomorrow around 3 works"],
    expectations: {
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => slotsForWeekday(now, "Tue", [14, 15, 16]),
  },
  {
    id: "roi-objection-price",
    category: "roi",
    name: "ROI price objection",
    phone: evalPhone("0003"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0003")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Missed calls are killing us", "How much does this cost per month?"],
    expectations: {
      forbiddenPatterns: [/\$\s?\d{1,4}\s*(?:\/mo|per month)/i],
      maxQuestionsPerTurn: 1,
    },
  },
  {
    id: "roi-objection-answering-service",
    category: "roi",
    name: "ROI answering service comparison",
    phone: evalPhone("0004"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0004")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Slow lead response", "We already use an answering service though"],
    expectations: { maxQuestionsPerTurn: 1 },
  },
  {
    id: "roi-objection-roi-explain",
    category: "roi",
    name: "ROI explanation request",
    phone: evalPhone("0005"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0005")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Follow-up is our issue", "How did you get the ROI number in the report?"],
    expectations: { maxQuestionsPerTurn: 1 },
  },
  {
    id: "roi-objection-office-staff",
    category: "roi",
    name: "ROI office staff objection",
    phone: evalPhone("0006"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0006")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Missed calls", "My office staff handles this fine already"],
    expectations: { maxQuestionsPerTurn: 1, mustNotBeAggressive: true },
  },
  {
    id: "roi-objection-not-ready",
    category: "roi",
    name: "ROI not ready",
    phone: evalPhone("0007"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0007")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Missed calls after hours", "Not ready to look at this right now"],
    expectations: { mustNotBeAggressive: true, mustNotConfirmBooking: true },
  },
  {
    id: "contact-context-aware",
    category: "contact",
    name: "Contact context-aware no re-ask",
    phone: evalPhone("0101"),
    buildSession: (now) => buildContactSession(now, evalPhone("0101")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["Yes after hours is the main issue for us"],
    expectations: {
      mustNotAskNeedAgain: true,
      customerGoalKeywords: ["after hours"],
      maxQuestionsPerTurn: 1,
    },
  },
  {
    id: "contact-product-question",
    category: "contact",
    name: "Contact direct product question",
    phone: evalPhone("0102"),
    buildSession: (now) => buildContactSession(now, evalPhone("0102")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["Can your AI actually book jobs or just answer questions?"],
    expectations: { mustNotAskNeedAgain: true, maxQuestionsPerTurn: 1 },
  },
  {
    id: "contact-integration-question",
    category: "contact",
    name: "Contact integration question",
    phone: evalPhone("0103"),
    buildSession: (now) => buildContactSession(now, evalPhone("0103")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["Does this integrate with ServiceTitan?"],
    expectations: { mustNotAskNeedAgain: true, maxQuestionsPerTurn: 1 },
  },
  {
    id: "contact-strong-interest",
    category: "contact",
    name: "Contact strong interest to scheduling",
    phone: evalPhone("0104"),
    buildSession: (now) => buildContactSession(now, evalPhone("0104")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["We're losing jobs after hours — need this fixed", "Let's set up a call", "Thursday morning works"],
    expectations: {
      mustNotAskNeedAgain: true,
      shouldReachScheduling: true,
      shouldOfferSlots: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Thu", [9, 10, 11]),
  },
  {
    id: "contact-weak-interest",
    category: "contact",
    name: "Contact weak interest pacing",
    phone: evalPhone("0105"),
    buildSession: (now) => buildContactSession(now, evalPhone("0105")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["Just gathering info for now", "Maybe later this year"],
    expectations: { mustNotBeAggressive: true, mustNotConfirmBooking: true },
  },
  {
    id: "demo-positive",
    category: "demo",
    name: "Demo positive toward scheduling",
    phone: evalPhone("0201"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0201")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: [
      "Yeah I could see that working for Lee Plumbing",
      "I'd like to talk about applying it to our business",
      "Tuesday afternoon works",
    ],
    expectations: { shouldReachScheduling: true, shouldOfferSlots: true },
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "demo-negative-robotic",
    category: "demo",
    name: "Demo Jessica sounded robotic",
    phone: evalPhone("0202"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0202")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: ["Jessica sounded kind of robotic honestly"],
    expectations: { mustAcknowledgeFeedback: true, mustNotBeAggressive: true },
  },
  {
    id: "demo-negative-misunderstood",
    category: "demo",
    name: "Demo Jessica misunderstood",
    phone: evalPhone("0203"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0203")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: ["She misunderstood what I was asking twice"],
    expectations: { mustAcknowledgeFeedback: true },
  },
  {
    id: "demo-production-question",
    category: "demo",
    name: "Demo production vs Jessica",
    phone: evalPhone("0204"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0204")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: ["Is Jessica exactly what we'd get in production?"],
    expectations: { maxQuestionsPerTurn: 1 },
  },
  {
    id: "demo-customization",
    category: "demo",
    name: "Demo customization question",
    phone: evalPhone("0205"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0205")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: ["Can you customize the voice and scripts for our company?"],
    expectations: { maxQuestionsPerTurn: 1 },
  },
  {
    id: "demo-just-testing",
    category: "demo",
    name: "Demo just testing curiosity",
    phone: evalPhone("0206"),
    buildSession: (now) => buildDemoSession(now, evalPhone("0206")),
    openingMessage: (s) => demoOpening(s as DemoConversationContext),
    customerTurns: ["I was just testing it out of curiosity", "Not really looking to buy anything"],
    expectations: { mustNotBeAggressive: true, mustNotConfirmBooking: true },
  },
  {
    id: "sched-tuesday-afternoon",
    category: "scheduling",
    name: "Scheduling Tuesday afternoon",
    phone: evalPhone("0301"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0301"), {
        knownFacts: { ...baseKnownFacts(buildRoiSession(now, evalPhone("0301"))), primaryPain: "missed calls" },
      }),
    customerTurns: ["Let's schedule a call", "Tuesday afternoon works"],
    expectations: { shouldOfferSlots: true },
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "sched-tomorrow-3",
    category: "scheduling",
    name: "Scheduling tomorrow around 3",
    phone: evalPhone("0302"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0302")),
    customerTurns: ["I want to talk", "Tomorrow around 3 works for me"],
    expectations: { shouldOfferSlots: true },
    presetSlots: (now) => {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const parts = parseCentralParts(tomorrow, TZ);
      return [centralDateAt(parts.year, parts.month, parts.day, 15, 0, TZ).toISOString()];
    },
  },
  {
    id: "sched-thursday-morning",
    category: "scheduling",
    name: "Scheduling Thursday morning",
    phone: evalPhone("0303"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0303")),
    customerTurns: ["Can we talk this week?", "Thursday morning"],
    expectations: { shouldOfferSlots: true },
    presetSlots: (now) => slotsForWeekday(now, "Thu", [9, 10, 11]),
  },
  {
    id: "sched-after-lunch",
    category: "scheduling",
    name: "Scheduling after lunch",
    phone: evalPhone("0304"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0304")),
    customerTurns: ["Let's find a time", "After lunch tomorrow"],
    expectations: { shouldOfferSlots: true },
    presetSlots: (now) => {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const parts = parseCentralParts(tomorrow, TZ);
      return [
        centralDateAt(parts.year, parts.month, parts.day, 13, 0, TZ).toISOString(),
        centralDateAt(parts.year, parts.month, parts.day, 14, 0, TZ).toISOString(),
      ];
    },
  },
  {
    id: "sched-later-this-week",
    category: "scheduling",
    name: "Scheduling later this week",
    phone: evalPhone("0305"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0305")),
    customerTurns: ["Interested in a consultation", "Later this week is best"],
    expectations: { shouldOfferSlots: true },
    presetSlots: (now) => tuesdayAfternoonSlots(now).slice(0, 3),
  },
  {
    id: "sched-change-days",
    category: "scheduling",
    name: "Scheduling change preferred days",
    phone: evalPhone("0306"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0306")),
    customerTurns: ["Let's schedule", "Tuesday afternoon", "Actually Friday morning is better"],
    expectations: { shouldOfferSlots: true },
    presetSlots: (now) => [
      ...tuesdayAfternoonSlots(now),
      ...slotsForWeekday(now, "Fri", [9, 10, 11]),
    ],
  },
  {
    id: "sched-select-slot",
    category: "scheduling",
    name: "Scheduling select offered slot",
    phone: evalPhone("0307"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0307")),
    customerTurns: ["Ready to book", "Tuesday afternoon", "The 2pm slot works"],
    expectations: { shouldOfferSlots: true, shouldConfirmBooking: true },
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "sched-different-time",
    category: "scheduling",
    name: "Scheduling request different time than offered",
    phone: evalPhone("0308"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0308")),
    customerTurns: ["Let's talk", "Tuesday afternoon", "Do you have anything around 4:30 instead?"],
    expectations: { shouldOfferSlots: true, mustNotConfirmBooking: true },
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "sched-slot-conflict",
    category: "scheduling",
    name: "Scheduling slot conflict alternatives",
    phone: evalPhone("0309"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0309")),
    customerTurns: ["Book me for Tuesday at 2pm", "Yes the 2pm one"],
    expectations: { mustNotConfirmBooking: true },
    calendarMode: "slot_conflict",
    presetSlots: tuesdayAfternoonSlots,
  },
  {
    id: "sched-calendar-fallback",
    category: "scheduling",
    name: "Scheduling calendar unavailable fallback",
    phone: evalPhone("0310"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0310")),
    customerTurns: ["I want to schedule a call", "Tuesday afternoon", "Okay what are my options?"],
    expectations: { shouldIncludeCalendarLink: true, mustNotConfirmBooking: true },
    calendarMode: "unconfigured",
  },
  {
    id: "edge-servicetitan",
    category: "edge",
    name: "Edge ServiceTitan capability question",
    phone: evalPhone("0401"),
    buildSession: (now) => buildContactSession(now, evalPhone("0401")),
    openingMessage: (s) => contactOpening(s as ContactConversationContext),
    customerTurns: ["Will this sync appointments directly into ServiceTitan for us?"],
    expectations: { mustNotAskNeedAgain: true },
  },
  {
    id: "edge-pricing-timeline",
    category: "edge",
    name: "Edge pricing and timeline",
    phone: evalPhone("0402"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0402")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "Missed calls are the issue",
      "What's the monthly price and how fast can you implement?",
    ],
    expectations: { forbiddenPatterns: [/\$\s?\d+\/mo/i, /\bwithin\s+\d+\s+weeks/i] },
  },
];
