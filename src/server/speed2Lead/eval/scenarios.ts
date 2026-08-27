import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  inferAvailabilityInputFromMessage,
  resolveLaterThisWeekRange,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
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
  return slotsForWeekday(now, "Tue", [13, 14, 16]);
}

function slotsForCentralDate(date: string, hours: number[]): string[] {
  const [year, month, day] = date.split("-").map(Number);
  return hours.map((hour) => centralDateAt(year, month, day, hour, 0, TZ).toISOString());
}

function slotsForTomorrow(now: Date, hours: number[]): string[] {
  return slotsForCentralDate(tomorrowCentralDate(now), hours);
}

function slotsForLaterThisWeek(now: Date, hours: number[]): string[] {
  const range = resolveLaterThisWeekRange(now);
  const slots: string[] = [];
  let cursor = new Date(range.rangeStart.getTime());
  while (cursor.getTime() <= range.rangeEnd.getTime()) {
    const parts = parseCentralParts(cursor, TZ);
    if (parts.weekday !== "Sat" && parts.weekday !== "Sun") {
      slots.push(
        ...hours.map((hour) =>
          centralDateAt(parts.year, parts.month, parts.day, hour, 0, TZ).toISOString(),
        ),
      );
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

function slotsMatchingMessage(message: string, now: Date, hours: number[]): string[] {
  const inferred = inferAvailabilityInputFromMessage(message, now);
  if (inferred?.centralDate) {
    return slotsForCentralDate(inferred.centralDate, hours);
  }
  if (inferred?.rangeStart && inferred?.rangeEnd) {
    return slotsForLaterThisWeek(now, hours);
  }
  return tuesdayAfternoonSlots(now);
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
    presetSlots: (now) => [
      ...slotsForTomorrow(now, [14, 15, 16]),
      ...slotsForWeekday(now, "Thu", [9, 10, 11]),
    ],
  },
  {
    id: "roi-discovery-to-scheduling",
    category: "roi",
    name: "ROI operational answer transitions to conversational scheduling",
    phone: evalPhone("0052"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0052"), {
        orchestratorManagedQuestions: true,
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0052"),
          flow: "roi",
          businessName: "Test Plumbing",
          customerGoal: "Slow response",
          primaryPain: "Slow response",
          fit: "yes",
          questionsAsked: 1,
        },
        messages: [
          {
            role: "assistant",
            content: "What's your process now when a new lead calls or texts?",
            at: now.toISOString(),
          },
        ],
      }),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["We just try to get back to them asap", "Tuesday afternoon works"],
    expectations: {
      shouldReachScheduling: true,
      maxQuestionsPerTurn: 1,
      forbiddenPatterns: [/grab a time here/i, /https?:\/\//],
    },
    presetSlots: tuesdayAfternoonSlots,
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
    id: "roi-regression-constraints",
    category: "roi",
    name: "ROI scheduling constraints — morning reject, afternoon, around 4",
    phone: evalPhone("0051"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0051")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "We're slow responding to leads",
      "Our staff handles them but can't get to them fast enough",
      "Yeah let's talk",
      "Tuesday works",
      "Morning doesn't work",
      "Afternoon",
      "Like 4pm",
      "4pm",
    ],
    expectations: {
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      maxDiscoveryTurns: 2,
      maxQuestionsPerTurn: 1,
      mustPreserveSchedulingConstraints: true,
    },
    presetSlots: (now) => [
      ...slotsForWeekday(now, "Tue", [9, 10, 11]),
      ...slotsForWeekday(now, "Tue", [12, 13, 15, 16, 17]),
    ],
  },
  {
    id: "roi-regression-evening-friday",
    category: "roi",
    name: "ROI evening preference preserved on Friday change",
    phone: evalPhone("0052"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0052")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "Follow up is our biggest issue",
      "Yeah I'd like to look at it",
      "Evenings work better",
      "Around 7",
      "Actually what about Friday instead",
    ],
    expectations: {
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      maxDiscoveryTurns: 2,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => [
      ...slotsForWeekday(now, "Tue", [16, 17]),
      ...slotsForWeekday(now, "Fri", [9, 10, 16, 17, 19]),
    ],
  },
  {
    id: "roi-regression-soft-close",
    category: "roi",
    name: "ROI soft close — OK does not restart scheduling",
    phone: evalPhone("0053"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0053")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "Missed calls mostly",
      "Not sure what we'd change honestly",
      "Not right now, im busy",
      "Ok",
    ],
    expectations: {
      mustNotReopenAfterSoftClose: true,
      mustNotConfirmBooking: true,
      maxDiscoveryTurns: 2,
      mustNotBeAggressive: true,
    },
  },
  {
    id: "roi-adversarial-pain-plus-schedule",
    category: "roi",
    name: "ROI pain and meeting intent same turn",
    phone: evalPhone("0054"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0054")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["We miss calls after hours — can we talk next week?"],
    expectations: {
      shouldReachScheduling: true,
      maxDiscoveryTurns: 1,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => slotsForLaterThisWeek(now, [10, 14, 16]),
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
    presetSlots: (now) => slotsForLaterThisWeek(now, [10, 13, 14, 16]),
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
    presetSlots: (now) => slotsForWeekday(now, "Tue", [13, 14, 16]),
  },
  {
    id: "sched-different-time",
    category: "scheduling",
    name: "Scheduling request different time than offered",
    phone: evalPhone("0308"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0308")),
    customerTurns: ["Let's talk", "Tuesday afternoon", "Do you have anything around 4:30 instead?"],
    expectations: { shouldOfferSlots: true, mustNotConfirmBooking: true },
    presetSlots: (now) => [
      ...slotsForWeekday(now, "Tue", [13, 14, 16]),
      ...slotsMatchingMessage("around 4:30", now, [16, 17]),
    ],
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
    name: "Scheduling explicit calendar link after calendar unavailable",
    phone: evalPhone("0310"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0310"), {
        scheduling: {
          status: "idle",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          availabilityAttempts: 2,
          calendarUnavailable: true,
        },
      }),
    customerTurns: ["Send me the calendar link"],
    expectations: {
      shouldIncludeCalendarLink: true,
      mustNotConfirmBooking: true,
      forbiddenPatterns: [/grab a time here:\s*$/i],
    },
    calendarMode: "unconfigured",
  },
  {
    id: "roi-vague-not-sure",
    category: "roi",
    name: "ROI vague pain — not sure",
    phone: evalPhone("0055"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0055")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Not sure honestly", "We might miss some calls I guess"],
    expectations: {
      maxDiscoveryTurns: 2,
      maxQuestionsPerTurn: 1,
      mustNotConfirmBooking: true,
      mustNotBeAggressive: true,
    },
  },
  {
    id: "roi-explicit-meeting",
    category: "roi",
    name: "ROI explicit meeting interest",
    phone: evalPhone("0056"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0056")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Missed calls after hours", "Let's schedule a call", "Friday afternoon"],
    expectations: {
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      maxDiscoveryTurns: 1,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "roi-substantive-reengage",
    category: "roi",
    name: "ROI substantive re-engagement after soft close",
    phone: evalPhone("0057"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0057")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "Missed calls",
      "Not right now, im busy",
      "Actually can we talk Friday afternoon?",
    ],
    expectations: {
      shouldReachScheduling: true,
      shouldOfferSlots: true,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-exact-time-book",
    category: "scheduling",
    name: "Scheduling exact time auto-book",
    phone: evalPhone("0311"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0311"), {
        knownFacts: {
          ...baseKnownFacts(buildRoiSession(now, evalPhone("0311"))),
          primaryPain: "missed calls",
          fit: "yes",
        },
      }),
    customerTurns: ["Friday at 4pm"],
    expectations: { shouldConfirmBooking: true, mustNotConfirmBooking: false },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [16]),
  },
  {
    id: "sched-rejected-times",
    category: "scheduling",
    name: "Scheduling rejected offered times",
    phone: evalPhone("0312"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0312")),
    customerTurns: ["Let's talk", "Tuesday afternoon", "None of those work", "Anything later?"],
    expectations: { shouldOfferSlots: true, mustNotConfirmBooking: true },
    presetSlots: (now) => [
      ...slotsForWeekday(now, "Tue", [13, 14]),
      ...slotsForWeekday(now, "Tue", [16, 17]),
    ],
  },
  {
    id: "edge-direct-question",
    category: "edge",
    name: "ROI direct how-does-it-work question",
    phone: evalPhone("0403"),
    buildSession: (now) => buildRoiSession(now, evalPhone("0403")),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["Missed calls mostly", "How does your AI actually handle new leads?"],
    expectations: { maxQuestionsPerTurn: 1, maxDiscoveryTurns: 2 },
  },
  {
    id: "edge-servicetitan-capability",
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
  {
    id: "stress-typo-selection",
    category: "edge",
    name: "Stress noisy typo slot selection",
    phone: evalPhone("0501"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0501"), {
        scheduling: {
          status: "slots_offered",
          offeredSlots: slotsForWeekday(now, "Wed", [15]),
          centralDate: inferAvailabilityInputFromMessage("Wednesday afternoon", now)?.centralDate,
          partOfDay: "afternoon",
        },
      }),
    customerTurns: ["3pm s good"],
    expectations: { shouldConfirmBooking: true },
    presetSlots: (now) => slotsForWeekday(now, "Wed", [15]),
  },
  {
    id: "stress-unauthorized-book",
    category: "edge",
    name: "Stress refinement blocks premature booking",
    phone: evalPhone("0502"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0502"), {
        scheduling: {
          status: "slots_offered",
          offeredSlots: slotsForWeekday(now, "Wed", [13, 14, 16]),
        },
      }),
    customerTurns: ["Anything around 4:30 instead?"],
    expectations: { mustNotConfirmBooking: true, shouldOfferSlots: true },
    presetSlots: (now) => [
      ...slotsForWeekday(now, "Wed", [13, 14, 16]),
      ...slotsForWeekday(now, "Wed", [16, 30, 17]),
    ],
  },
  {
    id: "stress-premature-calendar-link",
    category: "edge",
    name: "Stress healthy calendar resists link fallback",
    phone: evalPhone("0503"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0503"), {
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Friday afternoon", now)?.centralDate,
          partOfDay: "afternoon",
        },
      }),
    customerTurns: ["Friday afternoon"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/calendar\.app\.google/i],
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "stress-pending-work-reply",
    category: "edge",
    name: "Stress selection completes without pending-work SMS",
    phone: evalPhone("0504"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0504"), {
        scheduling: {
          status: "slots_offered",
          offeredSlots: slotsForWeekday(now, "Wed", [15]),
        },
      }),
    customerTurns: ["3 is good"],
    expectations: {
      shouldConfirmBooking: true,
      forbiddenPatterns: [/booking that now/i, /let me check/i, /reply with exactly/i],
    },
    presetSlots: (now) => slotsForWeekday(now, "Wed", [15]),
  },
  {
    id: "roi-missed-calls-bridge-meeting",
    category: "roi",
    name: "Missed calls bridge then meeting",
    phone: evalPhone("0060"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0060"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0060"),
          flow: "roi",
          businessName: "Test Plumbing",
          customerGoal: "Missed calls",
          primaryPain: "Missed calls",
          questionsAsked: 1,
        },
      }),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: [
      "They go to voicemail after hours",
      "Yeah worth a look",
      "Thursday afternoon",
    ],
    expectations: {
      shouldReachScheduling: true,
      maxQuestionsPerTurn: 1,
      forbiddenPatterns: [/grab a time here/i],
    },
    presetSlots: (now) => slotsForWeekday(now, "Thu", [14, 15, 16]),
  },
  {
    id: "roi-slow-response-bridge-meeting",
    category: "roi",
    name: "Slow response bridge then meeting",
    phone: evalPhone("0061"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0061"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0061"),
          flow: "roi",
          businessName: "Test Plumbing",
          customerGoal: "Slow response",
          primaryPain: "Slow response",
          questionsAsked: 1,
        },
      }),
    openingMessage: (s) => roiOpening(s as ConversationContext),
    customerTurns: ["We try but it's slow", "Sure makes sense", "Tuesday morning"],
    expectations: {
      shouldReachScheduling: true,
      maxQuestionsPerTurn: 1,
    },
    presetSlots: (now) => slotsForWeekday(now, "Tue", [9, 10, 11]),
  },
  {
    id: "sched-afternoon-please",
    category: "scheduling",
    name: "Semantic afternoon please after date known",
    phone: evalPhone("0062"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0062"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0062"),
          flow: "roi",
          businessName: "Test Plumbing",
          primaryPain: "Missed calls",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Friday", now)?.centralDate,
        },
      }),
    customerTurns: ["Let's do afternoon please"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-closed-day-request",
    category: "scheduling",
    name: "Closed day request redirects naturally",
    phone: evalPhone("0063"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0063"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0063"),
          flow: "roi",
          primaryPain: "Missed calls",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["Tomorrow afternoon"],
    expectations: {
      shouldReachScheduling: true,
      forbiddenPatterns: [/don't have anything open in that window/i],
    },
    presetSlots: (now) => slotsForWeekday(now, "Mon", [14, 15, 16]),
  },
  {
    id: "sched-stress-tuesday-afternoon",
    category: "scheduling",
    name: "Stress: Tuesday afternoon combined facts",
    phone: evalPhone("0070"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0070"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0070"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["Tuesday afternoon"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Tue", [14, 15, 16]),
  },
  {
    id: "sched-stress-after-lunch",
    category: "scheduling",
    name: "Stress: after lunch resolves afternoon",
    phone: evalPhone("0071"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0071"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0071"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Wednesday", now)?.centralDate,
        },
      }),
    customerTurns: ["After lunch works"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Wed", [13, 14, 15]),
  },
  {
    id: "sched-stress-no-afternoon",
    category: "scheduling",
    name: "Stress: no afternoon correction",
    phone: evalPhone("0072"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0072"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0072"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Friday", now)?.centralDate,
          partOfDay: "morning",
        },
      }),
    customerTurns: ["No, afternoon"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-stress-wednesday-around-4",
    category: "scheduling",
    name: "Stress: Wednesday around 4",
    phone: evalPhone("0073"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0073"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0073"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["Wednesday around 4"],
    expectations: {
      shouldReachScheduling: true,
      forbiddenPatterns: [/morning or afternoon\?/i, /grab a time here/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Wed", [15, 16, 17]),
  },
  {
    id: "sched-stress-next-friday-afternoon",
    category: "scheduling",
    name: "Stress: next Friday afternoon",
    phone: evalPhone("0074"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0074"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0074"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["Next Friday afternoon"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-stress-afternoon-would-be-best",
    category: "scheduling",
    name: "Stress: afternoon would be best with known date",
    phone: evalPhone("0075"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0075"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0075"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Friday", now)?.centralDate,
        },
      }),
    customerTurns: ["Afternoon would be best"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-stress-later-that-afternoon",
    category: "scheduling",
    name: "Stress: later that afternoon",
    phone: evalPhone("0076"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0076"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0076"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
        scheduling: {
          status: "idle",
          centralDate: inferAvailabilityInputFromMessage("Tuesday", now)?.centralDate,
        },
      }),
    customerTurns: ["Later that afternoon"],
    expectations: {
      shouldOfferSlots: true,
      forbiddenPatterns: [/morning or afternoon\?/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Tue", [14, 15, 16]),
  },
  {
    id: "sched-stress-friday-at-3",
    category: "scheduling",
    name: "Stress: Friday at 3",
    phone: evalPhone("0077"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0077"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0077"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["Friday at 3"],
    expectations: {
      shouldReachScheduling: true,
      forbiddenPatterns: [/morning or afternoon\?/i, /grab a time here/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Fri", [14, 15, 16]),
  },
  {
    id: "sched-stress-tuesday-around-230",
    category: "scheduling",
    name: "Stress: Tuesday around 2:30",
    phone: evalPhone("0078"),
    buildSession: (now) =>
      buildRoiSession(now, evalPhone("0078"), {
        knownFacts: {
          firstName: "Alex",
          phone: evalPhone("0078"),
          flow: "roi",
          meetingBridgeComplete: true,
          questionsAsked: 1,
        },
      }),
    customerTurns: ["How about Tuesday around 2:30"],
    expectations: {
      shouldReachScheduling: true,
      forbiddenPatterns: [/morning or afternoon\?/i, /grab a time here/i],
      requireNormalizedSchedulingFacts: true,
    },
    presetSlots: (now) => slotsForWeekday(now, "Tue", [14, 15, 16]),
  },
];
