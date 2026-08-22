import { describe, expect, test } from "bun:test";
import { advanceConversation } from "./stateMachine";
import * as messages from "./messages";
import type { ConversationContext } from "./types";

function createContext(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    phone: "+15551234567",
    firstName: "Speed",
    businessName: "Test S2L",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function walkToCompleted(
  steps: string[],
  startContext = createContext(),
): { context: ConversationContext; replies: string[] } {
  let context = startContext;
  const replies: string[] = [];

  for (const step of steps) {
    const result = advanceConversation(context, step);
    context = result.context;
    replies.push(result.reply);
  }

  return { context, replies };
}

describe("ROI natural-language flow", () => {
  test("clear pain skips priority and sends calendar", () => {
    const { context, replies } = walkToCompleted([
      "We miss a lot of calls after hours",
      "Yeah our team can't keep up",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("calendar");
    expect(replies.join(" ")).not.toContain("How much of a priority");
  });

  test("pain plus urgency skips priority question", () => {
    const { context, replies } = walkToCompleted([
      "We're losing a ton of jobs after hours and need to fix it.",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Absolutely");
    expect(replies[0]).toContain("calendar.app.google/test");
    expect(replies).toHaveLength(1);
  });

  test("meeting-ready reply sends calendar immediately", () => {
    const { context, replies } = walkToCompleted(["Can we talk?"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("calendar.app.google/test");
  });

  test("mild interested asks one question before calendar", () => {
    const { context, replies } = walkToCompleted(["interested", "missed calls"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("biggest leak");
    expect(replies[1]).toContain("calendar");
  });

  test("price question completes with calendar link", () => {
    const { context, replies } = walkToCompleted(["What does it cost?"]);
    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Pricing depends");
  });
});

describe("ROI opening message", () => {
  test("uses report-reaction opening", () => {
    expect(messages.initialMessage(createContext())).toContain("Which part stood out most");
    expect(messages.initialMessage(createContext({ annualOpportunity: "$1,806,780" }))).not.toContain(
      "calendar.app.google",
    );
  });
});
