import { describe, expect, test } from "bun:test";
import { buildShortNeedSummary, restateCustomerGoal } from "./needSummary";
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

  test("restates free-form goals", () => {
    expect(restateCustomerGoal("Better lead follow-up")).toContain("follow-up");
  });
});

describe("contact opening flow", () => {
  test("booking more jobs follow-up branch completes", () => {
    const { context, replies } = walk([
      "Booking more jobs",
      "Following up more consistently",
      "Manually",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("biggest opportunity right now");
    expect(replies[2]).toContain("consistent follow-up process");
  });

  test("reducing workload branch completes", () => {
    const { context, replies } = walk([
      "Reducing the workload on our office team",
      "Following up with leads",
      "About 10 hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("About how much time would you estimate");
  });

  test("improving customer calls branch completes", () => {
    const { context, replies } = walk([
      "Improving how customer calls are handled",
      "Fewer missed calls",
      "After hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("coverage issue more than a lead generation issue");
  });

  test("both revenue branch closes after one answer", () => {
    const { context, replies } = walk([
      "Both",
      "More booked revenue",
      "Unanswered calls",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("clearest path to measuring revenue impact");
    expect(replies).toHaveLength(3);
  });

  test("something else branch restates the customer goal", () => {
    const { context, replies } = walk([
      "Something else",
      "We need better scheduling for our dispatch team",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("main goal is");
    expect(replies[1]).toContain("calendar.app.google/test");
  });
});

describe("contact objection flows", () => {
  test("faq voice ai branch completes", () => {
    const { context, replies } = walk([
      "How does it work?",
      "Voice AI",
      "Inbound calls",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Which part are you most interested in");
    expect(replies[2]).toContain("good starting point");
  });

  test("vague yes booking branch completes", () => {
    const { context, replies } = walk([
      "Sure",
      "Booking more jobs",
      "Answering more calls",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("tells me where to focus");
  });

  test("price question completes immediately", () => {
    const { context, replies } = walk(["What does it cost?"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Based on your form");
  });
});
