import { describe, expect, test } from "bun:test";
import { advanceDemoConversation } from "./stateMachine";
import { createDemoSession } from "./startConversation";
import { initialMessage } from "./messages";

function createContext() {
  return createDemoSession({
    phone: "+15551234567",
    firstName: "Alex",
    lastName: "Smith",
    businessName: "Smith Plumbing",
    email: "alex@example.com",
    hasWebsite: true,
    smsConsent: true,
    demoCompletedAt: new Date().toISOString(),
    bookingUrl: "https://calendar.app.google/test",
  });
}

function walk(steps: string[], startContext = createContext()) {
  let context = startContext;
  const replies: string[] = [];

  for (const step of steps) {
    const result = advanceDemoConversation(context, step);
    context = result.context;
    replies.push(result.reply);
  }

  return { context, replies };
}

describe("demo natural-language flow", () => {
  test("yes branch asks workload then calendar", () => {
    const { context, replies } = walk([
      "Yeah I could see it working",
      "Answering after-hours calls",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("take off your team's plate");
    expect(replies[1]).toContain("calendar");
  });

  test("strong positive sends calendar immediately", () => {
    const { context, replies } = walk(["That was awesome"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Glad you liked it");
    expect(replies[0]).toContain("calendar.app.google/test");
    expect(replies).toHaveLength(1);
  });

  test("mild positive asks workload question first", () => {
    const { context, replies } = walk([
      "Pretty cool",
      "Scheduling",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("take off your team's plate");
  });

  test("no branch asks objection then may offer calendar", () => {
    const { context, replies } = walk([
      "No",
      "We are too custom for something like that but maybe if it handled after hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("biggest reason");
    expect(replies[1]).toContain("calendar");
  });

  test("negative feedback branch completes", () => {
    const { context, replies } = walk([
      "It felt robotic",
      "The scheduling felt fake",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[1]).toContain("fictional plumbing company");
  });
});

describe("demo global intents", () => {
  test("price question completes immediately", () => {
    const { context, replies } = walk(["What does it cost?"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("Pricing depends");
  });

  test("ready to book completes immediately", () => {
    const { context, replies } = walk(["Let's talk"]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("calendar.app.google/test");
  });

  test("meeting booked completes with confirmation", () => {
    const { context, replies } = walk(["I booked a time"]);

    expect(context.state).toBe("completed");
    expect(context.meetingBooked).toBe(true);
    expect(replies[0]).toContain("booking come through");
  });
});

describe("demo session bootstrap", () => {
  test("initial message uses business name and fit question", () => {
    const context = createContext();
    expect(context.flow).toBe("demo");
    expect(context.state).toBe("awaiting_fit");
    expect(initialMessage(context)).toContain("Smith Plumbing");
    expect(initialMessage(context)).toContain("could you actually see");
    expect(context.nextFollowUpAt).toBeTruthy();
  });
});
