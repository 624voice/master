import { advanceContactConversation } from "~/server/contactSpeed2Lead/stateMachine";
import { createContactSession } from "~/server/contactSpeed2Lead/startConversation";
import { advanceDemoConversation } from "~/server/demoSpeed2Lead/stateMachine";
import { createDemoSession } from "~/server/demoSpeed2Lead/startConversation";
import { advanceConversation } from "~/server/speed2Lead/stateMachine";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import type { ConversationContext } from "~/server/speed2Lead/types";

const BOOKING_URL = "https://calendar.app.google/test";

export type FlowKind = "roi" | "contact" | "demo";

export type SimulationResult = {
  flow: FlowKind;
  name: string;
  steps: string[];
  replies: string[];
  finalState: string;
  questionCount: number;
  hasCalendar: boolean;
  completed: boolean;
  violations: string[];
};

export type ScenarioExpectation = {
  maxQuestions?: number;
  minQuestions?: number;
  expectCalendar?: boolean;
  expectNoCalendar?: boolean;
  expectCompleted?: boolean;
  expectNotCompleted?: boolean;
  replyContains?: string[];
  replyNotContains?: string[];
  noRepeatedQuestions?: boolean;
  noUnsupportedRoiClaims?: boolean;
};

export type SimulationScenario = {
  flow: FlowKind;
  name: string;
  steps: string[];
  contactMessage?: string;
  expect: ScenarioExpectation;
};

function createRoiContext(): ConversationContext {
  return {
    phone: "+15551234567",
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: BOOKING_URL,
    state: "awaiting_problem",
    updatedAt: new Date().toISOString(),
  };
}

function createContactContext(message = "We need help answering more calls after hours"): ContactConversationContext {
  return createContactSession({
    phone: "+15551234567",
    firstName: "Chris",
    businessName: "Test Plumbing",
    message,
    bookingUrl: BOOKING_URL,
  });
}

function createDemoContext(): DemoConversationContext {
  return createDemoSession({
    phone: "+15551234567",
    firstName: "Alex",
    lastName: "Smith",
    businessName: "Smith Plumbing",
    email: "alex@example.com",
    hasWebsite: true,
    smsConsent: true,
    demoCompletedAt: new Date().toISOString(),
    bookingUrl: BOOKING_URL,
  });
}

function countQuestions(replies: string[]): number {
  return replies.filter((reply) => reply.trim().endsWith("?")).length;
}

function hasRepeatedQuestions(replies: string[]): boolean {
  const normalized = replies.map((r) => r.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

const UNSUPPORTED_ROI_CLAIMS = [
  "meaningful",
  "significant",
  "jumped out at me",
  "large opportunity",
  "huge opportunity",
];

export function simulateScenario(scenario: SimulationScenario): SimulationResult {
  let context: ConversationContext | ContactConversationContext | DemoConversationContext =
    scenario.flow === "roi"
      ? createRoiContext()
      : scenario.flow === "contact"
        ? createContactContext(scenario.contactMessage)
        : createDemoContext();

  const replies: string[] = [];

  for (const step of scenario.steps) {
    const result =
      scenario.flow === "roi"
        ? advanceConversation(context as ConversationContext, step)
        : scenario.flow === "contact"
          ? advanceContactConversation(context as ContactConversationContext, step)
          : advanceDemoConversation(context as DemoConversationContext, step);
    context = result.context;
    replies.push(result.reply);
  }

  const questionCount = countQuestions(replies);
  const hasCalendar = replies.some((r) => r.includes(BOOKING_URL));
  const completed = context.state === "completed";
  const violations: string[] = [];

  const { expect } = scenario;

  if (expect.maxQuestions !== undefined && questionCount > expect.maxQuestions) {
    violations.push(`Expected at most ${expect.maxQuestions} questions, got ${questionCount}`);
  }
  if (expect.minQuestions !== undefined && questionCount < expect.minQuestions) {
    violations.push(`Expected at least ${expect.minQuestions} questions, got ${questionCount}`);
  }
  if (expect.expectCalendar && !hasCalendar) {
    violations.push("Expected calendar link but none was sent");
  }
  if (expect.expectNoCalendar && hasCalendar) {
    violations.push("Expected no calendar link but one was sent");
  }
  if (expect.expectCompleted && !completed) {
    violations.push(`Expected completed state, got ${context.state}`);
  }
  if (expect.expectNotCompleted && completed) {
    violations.push("Expected conversation to remain open");
  }
  for (const phrase of expect.replyContains ?? []) {
    const found = replies.some((r) => r.toLowerCase().includes(phrase.toLowerCase()));
    if (!found) {
      violations.push(`Expected reply to contain "${phrase}"`);
    }
  }
  for (const phrase of expect.replyNotContains ?? []) {
    const found = replies.some((r) => r.toLowerCase().includes(phrase.toLowerCase()));
    if (found) {
      violations.push(`Expected reply NOT to contain "${phrase}"`);
    }
  }
  if (expect.noRepeatedQuestions && hasRepeatedQuestions(replies)) {
    violations.push("Detected repeated identical agent replies");
  }
  if (expect.noUnsupportedRoiClaims) {
    for (const claim of UNSUPPORTED_ROI_CLAIMS) {
      if (replies.some((r) => r.toLowerCase().includes(claim))) {
        violations.push(`Unsupported ROI claim detected: "${claim}"`);
      }
    }
  }

  return {
    flow: scenario.flow,
    name: scenario.name,
    steps: scenario.steps,
    replies,
    finalState: context.state,
    questionCount,
    hasCalendar,
    completed,
    violations,
  };
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  // ROI — 18 scenarios
  { flow: "roi", name: "ROI: missed calls after 5 typo", steps: ["we miss alot of calls after 5", "high priority"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: CSR drowning slang", steps: ["my csr is drowning lol", "pretty high priority"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: all of it", steps: ["all of it lol", "yes its urgent"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: pain plus urgency same reply", steps: ["we're losing a ton of jobs after hours and need to fix it"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: one-word interested", steps: ["interested", "missed calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: sounds good no context", steps: ["sounds good", "missed calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: explicit can we talk", steps: ["can we talk?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: I need this", steps: ["I need this"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: call me", steps: ["call me"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: how much", steps: ["how much?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, replyContains: ["Pricing"], noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: answering service objection", steps: ["we already have an answering service"], expect: { maxQuestions: 1, expectNotCompleted: true, expectNoCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: receptionist handles this", steps: ["my receptionist handles this"], expect: { maxQuestions: 1, expectNotCompleted: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: not interested", steps: ["not interested"], expect: { expectCompleted: true, expectNoCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: who is this", steps: ["who is this?"], expect: { maxQuestions: 1, expectNotCompleted: true, expectNoCalendar: true, replyContains: ["Chris with 624Voice"], noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: long answer with follow-up pain", steps: ["honestly our biggest issue is we get leads from google and by the time someone calls them back they've already booked someone else", "very high priority"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: pain then sounds good", steps: ["missed calls after hours", "sounds good"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: customer asks question instead", steps: ["how does this actually work?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, replyContains: ["AI agents"], noUnsupportedRoiClaims: true } },
  { flow: "roi", name: "ROI: vague k", steps: ["k", "missed calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true, noUnsupportedRoiClaims: true } },

  // Contact — 18 scenarios
  { flow: "contact", name: "Contact: miss calls after hours", steps: ["We keep missing calls after hours.", "voicemail mostly"], contactMessage: "Need help with calls", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: urgent after hours", steps: ["We desperately need something answering our phones after 5"], contactMessage: "After hours calls", expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: website only", steps: ["Need a new website.", "looks outdated"], contactMessage: "Need a new website", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: just looking for info", steps: ["Just looking for information.", "The AI side"], contactMessage: "General inquiry", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: interested no context", steps: ["interested"], contactMessage: "General inquiry", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: sounds good with form context", steps: ["sounds good"], contactMessage: "We miss calls after hours every night", expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: can we talk tomorrow", steps: ["can we talk tomorrow?"], contactMessage: "Help with leads", expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: how much", steps: ["what does it cost?"], contactMessage: "AI help", expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, replyContains: ["Pricing"] } },
  { flow: "contact", name: "Contact: send me info", steps: ["send me info"], contactMessage: "Looking for info", expect: { expectNotCompleted: true, replyContains: ["learn more here"] } },
  { flow: "contact", name: "Contact: who is this", steps: ["how did you get my number?"], contactMessage: "Call handling", expect: { maxQuestions: 1, expectNotCompleted: true, replyContains: ["contact form"] } },
  { flow: "contact", name: "Contact: not interested", steps: ["not interested"], contactMessage: "Help", expect: { expectCompleted: true, expectNoCalendar: true } },
  { flow: "contact", name: "Contact: CSR drowning", steps: ["my csr is drowning, we cant keep up", "voicemail mostly"], contactMessage: "Office overwhelmed", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: multiple problems", steps: ["missed calls AND slow follow up honestly all of it", "voicemail"], contactMessage: "Multiple issues", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: subject change to price", steps: ["website stuff", "actually how much is this?"], contactMessage: "Website", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: answering service", steps: ["we already have an answering service"], contactMessage: "Calls", expect: { maxQuestions: 1, expectNotCompleted: true } },
  { flow: "contact", name: "Contact: pretty cool", steps: ["pretty cool", "after hours calls"], contactMessage: "General", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: long indirect answer", steps: ["well customers still cant reach anyone after 5pm", "voicemail"], contactMessage: "Call issues", expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "contact", name: "Contact: sure one word", steps: ["sure"], contactMessage: "Help with scheduling", expect: { maxQuestions: 1, expectCompleted: true } },

  // Demo — 18 scenarios
  { flow: "demo", name: "Demo: that was awesome", steps: ["That was awesome"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: pretty cool", steps: ["Pretty cool", "Answering after-hours calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: interested", steps: ["interested", "scheduling"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: I need this", steps: ["I need this"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: can we talk", steps: ["can we talk?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: yes workload path", steps: ["yeah definitely", "after hours calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: no with objection resolved", steps: ["no", "maybe if it handled after hours calls"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: negative feedback", steps: ["felt robotic", "the scheduling felt fake"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: demo error", steps: ["she misunderstood my address", "she thought we were in dallas", "yes"], expect: { maxQuestions: 2, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: how much", steps: ["how much?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true, replyContains: ["Pricing"] } },
  { flow: "demo", name: "Demo: already use AI", steps: ["we already use AI"], expect: { maxQuestions: 1, expectNotCompleted: true } },
  { flow: "demo", name: "Demo: I booked", steps: ["I booked"], expect: { expectCompleted: true, replyContains: ["booking come through"], expectNoCalendar: true } },
  { flow: "demo", name: "Demo: not interested", steps: ["not interested"], expect: { expectCompleted: true, expectNoCalendar: true } },
  { flow: "demo", name: "Demo: who is this", steps: ["who is this?"], expect: { maxQuestions: 1, expectNotCompleted: true, replyContains: ["Jessica demo"] } },
  { flow: "demo", name: "Demo: maybe", steps: ["maybe", "follow up texts"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: sounds good", steps: ["sounds good", "booking appointments"], expect: { maxQuestions: 1, expectCompleted: true, expectCalendar: true } },
  { flow: "demo", name: "Demo: just testing", steps: ["just testing it out", "no not really"], expect: { expectCompleted: true, expectNoCalendar: true } },
  { flow: "demo", name: "Demo: how do we get started", steps: ["how do we get started?"], expect: { maxQuestions: 0, expectCompleted: true, expectCalendar: true } },
];

export function runAllSimulations(): SimulationResult[] {
  return SIMULATION_SCENARIOS.map(simulateScenario);
}
