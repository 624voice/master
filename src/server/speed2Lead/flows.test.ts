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

describe("booking more jobs flow", () => {
  test("answering more calls branch completes with calendar link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "answering more calls",
      "After hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("improving coverage in that window");
    expect(replies[2]).toContain("calendar.app.google/test");
  });

  test("responding faster branch completes with calendar link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "Responding to new leads faster",
      "Usually within an hour",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("How quickly is your team usually able to respond");
    expect(replies[2]).toContain("Speed is often where the first opportunity shows up");
  });

  test("follow up branch completes with calendar link", () => {
    const { context, replies } = walkToCompleted([
      "Booking more jobs",
      "Following up more consistently",
      "Manually",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("consistent follow-up process could help you recover more value");
  });
});

describe("growing without staff flow", () => {
  test("pressure question then time estimate then calendar link", () => {
    const { context, replies } = walkToCompleted([
      "Growing without adding staff",
      "Following up with leads",
      "About 10 hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("About how much time would you estimate");
    expect(replies[2]).toContain("reduce that workload while still giving customers");
  });
});

describe("both flow", () => {
  test("booking revenue subgoal closes after one answer", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Booking more revenue",
      "responding faster",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("answering more calls, responding faster, or following up");
    expect(replies[2]).toContain("clearest path to measuring revenue impact first");
    expect(replies).toHaveLength(3);
  });

  test("freeing up time closes after one answer", () => {
    const { context, replies } = walkToCompleted([
      "Both",
      "Freeing up my team's time",
      "Lead follow-up",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("creating capacity without adding another employee");
    expect(replies).toHaveLength(3);
  });
});

describe("not sure flow", () => {
  test("completes with calendar link", () => {
    const { context, replies } = walkToCompleted([
      "I'm not sure",
      "Team is stretched too thin",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("highest-value opportunity");
  });
});

describe("vague yes flow", () => {
  test("booking more jobs branch uses vague booking closing", () => {
    const { context, replies } = walkToCompleted([
      "Sure",
      "Booking more jobs",
      "Following up more consistently",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("which is the bigger priority right now");
    expect(replies[2]).toContain("Thanks, that gives me a better idea of where to focus");
  });

  test("reducing workload branch uses vague staff closing", () => {
    const { context, replies } = walkToCompleted([
      "Sure",
      "Reducing the workload",
      "Lead follow-up",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("What takes up the most office time right now");
    expect(replies[2]).toContain("giving every customer a fast and professional response");
  });

  test("both branch revenue path uses vague both revenue closing", () => {
    const { context, replies } = walkToCompleted([
      "Sure",
      "Both",
      "More booked revenue",
      "Unanswered calls",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("opportunities are most likely slipping through");
    expect(replies[3]).toContain("clearest way to measure revenue impact");
  });

  test("both branch time path uses vague both time closing", () => {
    const { context, replies } = walkToCompleted([
      "Sure",
      "Both",
      "Freeing up my team's time",
      "Scheduling",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[3]).toContain("most practical place to begin");
  });

  test("remains vague and gets fallback calendar link", () => {
    const { context, replies } = walkToCompleted(["Sure", "I don't know"]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("spend 15 minutes reviewing the numbers");
  });
});

describe("objection flows", () => {
  test("faq unrecognized reply re-asks faq", () => {
    let context = createContext();
    ({ context } = advanceConversation(context, "How does it work?"));

    const result = advanceConversation(context, "Hmm maybe");
    expect(result.context.state).toBe("awaiting_faq_followup");
    expect(result.reply).toBe(messages.faqMessage(context));
  });

  test("price question completes with calendar link", () => {
    const { context, replies } = walkToCompleted(["What does it cost?"]);
    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("compare the cost against");
  });

  test("schedule yes completes with calendar link", () => {
    const { context, replies } = walkToCompleted(["Yes let's talk"]);
    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Once you book, you will receive a confirmation");
  });
});

describe("intent matching", () => {
  test("matches revised subgoal phrases", () => {
    expect(classifySubgoalIntent("Responding to new leads faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifySubgoalIntent("responding faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifyIntent("Reducing the workload")).toBe("goal_growing_staff");
    expect(classifyIntent("More booked revenue")).toBe("subgoal_booking_revenue");
  });
});

describe("legacy state compatibility", () => {
  test("legacy both revenue detail state still completes", () => {
    const result = advanceConversation(
      createContext({ state: "awaiting_both_revenue_detail" }),
      "Manually",
    );

    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});
