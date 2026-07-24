import { describe, expect, test } from "bun:test";
import { advanceDemoConversation } from "./stateMachine";
import { createDemoSession } from "./startConversation";

function createContext() {
  return createDemoSession({
    phone: "+15551234567",
    firstName: "Alex",
    lastName: "Smith",
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

describe("demo opening flow", () => {
  test("faq after-hours branch completes", () => {
    const { context, replies } = walk([
      "She answered questions well",
      "After hours calls",
      "Voicemail",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[0]).toContain("most valuable in your business");
    expect(replies[1]).toContain("voicemail");
    expect(replies[2]).toContain("booking link");
  });

  test("booking scheduling branch completes", () => {
    const { context, replies } = walk([
      "Booking the visit",
      "Reducing scheduling work",
      "Confirming appointments",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("consultation");
  });

  test("maintenance recurring revenue yes branch completes", () => {
    const { context, replies } = walk([
      "The maintenance plan",
      "Creating recurring revenue",
      "Yes",
      "Not very consistently",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[3]).toContain("recurring revenue");
  });

  test("multiple features revenue branch completes", () => {
    const { context, replies } = walk([
      "All of it",
      "Capturing more revenue",
      "Unanswered inquiries",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("AI workflows");
  });

  test("not sure immediate response branch completes", () => {
    const { context, replies } = walk([
      "I'm not sure",
      "Immediate response",
      "When they call after hours",
    ]);

    expect(context.state).toBe("completed");
    expect(replies[2]).toContain("customer journey gap");
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
    expect(replies[0]).toContain("25-minute time");
  });

  test("meeting booked completes with confirmation", () => {
    const { context, replies } = walk(["I booked a time"]);

    expect(context.state).toBe("completed");
    expect(context.meetingBooked).toBe(true);
    expect(replies[0]).toContain("booking come through");
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

describe("demo session bootstrap", () => {
  test("initial message uses first name only", () => {
    const context = createContext();
    expect(context.flow).toBe("demo");
    expect(context.state).toBe("awaiting_demo_feature");
    expect(context.nextFollowUpAt).toBeTruthy();
  });
});
