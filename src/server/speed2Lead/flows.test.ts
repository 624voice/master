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
    annualOpportunity: "$0",
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
  test("clear problem then priority then calendar", () => {
    const { context, replies } = walkToCompleted([
      "We miss a lot of calls after hours",
      "It's a pretty big priority right now",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("How much of a priority");
    expect(replies[1]).toContain("calendar");
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

  test("price question completes with calendar link", () => {
    const { context, replies } = walkToCompleted(["What does it cost?"]);
    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Pricing depends");
  });

  test("direct opening reply can resend calendar", () => {
    const context = createContext({ annualOpportunity: "$120,000", directOpening: true });
    const result = advanceConversation(context, "Sounds good");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("ROI opening message", () => {
  test("uses question opening when ROI is zero", () => {
    expect(messages.initialMessage(createContext())).toContain(
      "where do you think you're losing the most opportunities",
    );
  });

  test("uses direct calendar opening when ROI is meaningful", () => {
    expect(
      messages.initialMessage(createContext({ annualOpportunity: "$120,000" })),
    ).toContain("estimated $120,000 in missed revenue");
  });
});
