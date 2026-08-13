import { describe, expect, test } from "bun:test";
import { buildShortNeedSummary } from "./needSummary";
import { advanceContactConversation } from "./stateMachine";
import { createContactSession } from "./startConversation";

function createContext(message = "We need help answering more calls after hours") {
  return createContactSession({
    phone: "+15551234567",
    firstName: "Chris",
    businessName: "Test Plumbing",
    message,
    bookingUrl: "https://calendar.app.google/test",
  });
}

function walk(steps: string[], startContext = createContext()) {
  let context = startContext;
  const replies: string[] = [];

  for (const step of steps) {
    const result = advanceContactConversation(context, step);
    context = result.context;
    replies.push(result.reply);
  }

  return { context, replies };
}

describe("contact need summary", () => {
  test("detects website requests", () => {
    expect(buildShortNeedSummary("We need a new website")).toBe("a new website");
  });
});

describe("contact natural-language flow", () => {
  test("missed calls follow-up then calendar", () => {
    const { context, replies } = walk([
      "We keep missing calls after hours.",
      "Mostly voicemail",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("What happens with those calls today");
    expect(replies[1]).toContain("calendar");
  });

  test("urgent after-hours request skips follow-up", () => {
    const { context, replies } = walk([
      "We desperately need something answering our phones after 5. Can your system do that?",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("after-hours");
    expect(replies[0]).toContain("calendar.app.google/test");
    expect(replies).toHaveLength(1);
  });

  test("website branch asks one question then calendar", () => {
    const { context, replies } = walk([
      "Need a new website.",
      "Our current site looks outdated",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("biggest issue with the site");
    expect(replies[1]).toContain("calendar");
  });

  test("information seeker gets area question then calendar path", () => {
    const { context, replies } = walk([
      "Just looking for information.",
      "The AI side",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("website side or the AI");
    expect(replies[1]).toContain("calendar");
  });

  test("price question completes immediately", () => {
    const { context, replies } = walk(["What does it cost?"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Pricing depends");
  });
});

describe("contact opening message", () => {
  test("uses free-form prompt opening", () => {
    const context = createContext();
    expect(context.state).toBe("awaiting_prompt");
  });
});
