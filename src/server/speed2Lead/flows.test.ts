import { describe, expect, test } from "bun:test";
import { classifyIntent, classifySubgoalIntent } from "./intents";
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
    annualOpportunity: "$1,266,144",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_goal",
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

describe("classifySubgoalIntent", () => {
  test("matches exact prompt phrases from booking subgoal question", () => {
    expect(classifySubgoalIntent("answering more calls")).toBe(
      "subgoal_answering_calls",
    );
    expect(classifySubgoalIntent("Responding to new leads faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifySubgoalIntent("Responding to leads faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifySubgoalIntent("Following up more consistently")).toBe(
      "subgoal_follow_up",
    );
    expect(classifySubgoalIntent("responding faster")).toBe(
      "subgoal_responding_faster",
    );
  });
});

describe("advanceConversation booking flow", () => {
  test("booking more jobs -> responding faster -> free-form answer -> booking link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "Responding to new leads faster",
      "Usually within an hour",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("How quickly is your team usually able to respond");
    expect(replies[2]).toContain("Speed is often where the first opportunity shows up");
    expect(replies[2]).toContain("calendar.app.google/test");
  });

  test("booking more jobs -> follow up -> manually -> branch-specific booking link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "Following up more consistently",
      "Manually",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain(
      "A consistent follow-up process could help you recover more value",
    );
    expect(replies[2]).toContain("calendar.app.google/test");
  });

  test("booking more jobs -> answering calls -> free-form answer -> booking link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "answering more calls",
      "After hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("missed during business hours");
    expect(replies[2]).toContain("improving coverage in that window");
    expect(replies[2]).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation both flow", () => {
  test("both -> booking revenue -> responding faster -> branch-specific booking link", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Booking more revenue",
      "responding to new leads faster",
      "Same day",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("How quickly is your team usually able to respond");
    expect(replies[3]).toContain("Speed is often where the first opportunity shows up");
    expect(replies[3]).toContain("calendar.app.google/test");
  });

  test("both -> booking revenue -> follow up -> manually -> branch-specific booking link", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Booking more revenue",
      "Following up more consistently",
      "Manually",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[3]).toContain(
      "A consistent follow-up process could help you recover more value",
    );
    expect(replies[3]).toContain("calendar.app.google/test");
  });

  test("both -> booking revenue -> answering calls -> branch-specific booking link", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Booking more revenue",
      "answering more calls",
      "Business hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[3]).toContain("improving coverage in that window");
    expect(replies[3]).toContain("calendar.app.google/test");
  });

  test("both -> freeing time -> task -> time estimate -> booking link", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Freeing up my team's time",
      "Lead follow-up",
      "About 10 hours",
    ]);

    expect(context.state).toBe("completed");
    expect(context.track).toBe("both_time");
    expect(replies[2]).toContain("About how much time would you estimate");
    expect(replies[3]).toContain("creating capacity without adding another employee");
    expect(replies[3]).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation staff flow", () => {
  test("growing without staff -> free-form answers -> booking link", () => {
    const { context, replies } = walkToCompleted([
      "Growing without adding staff",
      "Following up with leads",
      "About 10 hours",
    ]);

    expect(context.state).toBe("completed");
    expect(context.track).toBe("staff");
    expect(replies[2]).toContain("reduce that workload while still giving customers");
    expect(replies[2]).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation not sure flow", () => {
  test("not sure -> free-form answer -> booking link", () => {
    const { context, replies } = walkToCompleted([
      "Not sure",
      "Team is stretched too thin",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation objection and helper flows", () => {
  test("faq -> unrecognized reply re-asks faq instead of restarting", () => {
    let context = createContext();
    ({ context } = advanceConversation(context, "How does it work?"));
    expect(context.state).toBe("awaiting_faq_followup");

    const result = advanceConversation(context, "Hmm maybe");
    expect(result.context.state).toBe("awaiting_faq_followup");
    expect(result.reply).toBe(messages.faqMessage(context));
  });

  test("legacy both revenue detail state still completes", () => {
    const result = advanceConversation(
      createContext({ state: "awaiting_both_revenue_detail" }),
      "Manually",
    );

    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation free-form states ignore schedule hijack", () => {
  test("does not treat schedule keyword as booking shortcut during follow-up question", () => {
    const result = advanceConversation(
      createContext({ state: "awaiting_booking_followup_process" }),
      "We schedule callbacks manually",
    );

    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("consistent follow-up process");
  });
});
