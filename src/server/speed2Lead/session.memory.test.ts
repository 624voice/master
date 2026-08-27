import { describe, expect, test } from "bun:test";
import { createDemoSession } from "~/server/demoSpeed2Lead/startConversation";
import {
  appendAssistantMessage,
  appendUserMessage,
  applyConfirmedScheduling,
  MAX_CONVERSATION_MESSAGES,
  normalizeSessionMemory,
  seedKnownFacts,
} from "~/server/speed2Lead/memory";
import { createSession } from "~/server/speed2Lead/session";
import type { ContactConversationContext, ConversationContext } from "~/server/speed2Lead/types";
import { buildShortNeedSummary } from "~/server/speed2Lead/agent/contactFlow/needSummary";

function legacyRoiSession(): ConversationContext {
  return {
    flow: "roi",
    phone: "+15551234567",
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    detectedPains: ["missed_calls"],
    lastCustomerMessage: "We miss calls after hours",
    updatedAt: "2026-01-01T12:00:00.000Z",
  };
}

describe("session memory normalization", () => {
  test("legacy sessions deserialize with V2 memory defaults", () => {
    const normalized = normalizeSessionMemory(legacyRoiSession());

    expect(normalized.messages).toEqual([]);
    expect(normalized.scheduling).toEqual({ status: "idle" });
    expect(normalized.knownFacts.firstName).toBe("Alex");
    expect(normalized.knownFacts.phone).toBe("+15551234567");
    expect(normalized.knownFacts.flow).toBe("roi");
    expect(normalized.knownFacts.businessName).toBe("Test Plumbing");
    expect(normalized.knownFacts.customerGoal).toBe("Missed calls");
    expect(normalized.knownFacts.primaryPain).toBe("after-hours and missed-call coverage");
    expect(normalized.state).toBe("awaiting_problem");
  });

  test("new ROI sessions include seeded knownFacts and empty scheduling", () => {
    const session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      lastName: "Smith",
      businessName: "Test Plumbing",
      email: "alex@example.com",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    expect(session.messages).toEqual([]);
    expect(session.scheduling).toEqual({ status: "idle" });
    expect(session.knownFacts.flow).toBe("roi");
    expect(session.knownFacts.email).toBe("alex@example.com");
    expect(session.knownFacts.customerGoal).toBe("Missed calls");
    expect(session.knownFacts.trade).toBeUndefined();
  });

  test("ROI sessions seed lead-form facts when provided", () => {
    const session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      trade: "plumbing",
      truckCount: 3,
      monthlyCalls: 120,
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    expect(session.knownFacts.monthlyCalls).toBe(120);
    expect(session.knownFacts.truckCount).toBe(3);
    expect(session.knownFacts.trade).toBe("plumbing");
  });

  test("legacy Contact sessions deserialize with customerGoal from form summary", () => {
    const summary = buildShortNeedSummary("We need help with missed calls after hours");
    const session = normalizeSessionMemory({
      flow: "contact",
      phone: "+15551234567",
      firstName: "Chris",
      businessName: "Test Plumbing",
      shortNeedSummary: summary,
      relevantSolution: "AI voice agents",
      relevantLink: "https://www.624voice.com/services",
      relevantExample: "https://www.624voice.com/book",
      bookingUrl: "https://calendar.app.google/test",
      state: "awaiting_prompt",
      updatedAt: "2026-01-01T12:00:00.000Z",
    } satisfies ContactConversationContext);

    expect(session.knownFacts.flow).toBe("contact");
    expect(session.knownFacts.customerGoal).toBe("better call handling");
  });

  test("new Demo sessions seed email and business metadata", () => {
    const session = createDemoSession({
      phone: "+15551234567",
      firstName: "Alex",
      lastName: "Smith",
      businessName: "Smith Plumbing",
      email: "alex@example.com",
      hasWebsite: true,
      smsConsent: true,
      demoCompletedAt: "2026-01-01T12:00:00.000Z",
      bookingUrl: "https://calendar.app.google/test",
    });

    expect(session.knownFacts.flow).toBe("demo");
    expect(session.knownFacts.email).toBe("alex@example.com");
    expect(session.knownFacts.businessName).toBe("Smith Plumbing");
    expect(session.followUpStage).toBe(0);
  });
});

describe("session message history", () => {
  test("records opening assistant messages", () => {
    const session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    const opening =
      "Hey Alex, Chris with 624Voice. I just sent your ROI report over.";
    const updated = appendAssistantMessage(session, opening);

    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]).toMatchObject({
      role: "assistant",
      content: opening,
    });
  });

  test("appends inbound and outbound turns in order", () => {
    let session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    session = appendAssistantMessage(session, "Opening question?");
    session = appendUserMessage(session, "Missed calls after hours");
    session = appendAssistantMessage(session, "Got it. Here's my calendar.");

    expect(session.messages.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(session.knownFacts.customerGoal).toBe("Missed calls");
    expect(session.knownFacts.primaryPain).toBe("missed calls");
    expect(session.knownFacts.questionsAsked).toBe(0);
  });

  test("caps message history at the latest 20 entries", () => {
    let session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    for (let index = 0; index < MAX_CONVERSATION_MESSAGES + 5; index += 1) {
      session =
        index % 2 === 0
          ? appendUserMessage(session, `user-${index}`)
          : appendAssistantMessage(session, `assistant-${index}`);
    }

    expect(session.messages).toHaveLength(MAX_CONVERSATION_MESSAGES);
    expect(session.messages[0]?.content).toBe("assistant-5");
    expect(session.messages.at(-1)?.content).toBe(
      `user-${MAX_CONVERSATION_MESSAGES + 4}`,
    );
  });

  test("does not duplicate identical consecutive user messages", () => {
    let session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    session = appendUserMessage(session, "same reply");
    session = appendUserMessage(session, "same reply");

    expect(session.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  test("does not duplicate identical consecutive assistant messages", () => {
    let session = createSession({
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
    });

    session = appendAssistantMessage(session, "Thanks!");
    session = appendAssistantMessage(session, "Thanks!");

    expect(session.messages.filter((message) => message.role === "assistant")).toHaveLength(
      1,
    );
  });
});

describe("applyConfirmedScheduling", () => {
  test("sets scheduling confirmation fields without changing conversation state", () => {
    const session = applyConfirmedScheduling(legacyRoiSession(), {
      selectedStart: "2026-08-19T15:00:00.000Z",
      calendarEventId: "evt-agent-1",
    });

    expect(session.scheduling).toEqual({
      status: "confirmed",
      selectedStart: "2026-08-19T15:00:00.000Z",
      calendarEventId: "evt-agent-1",
      bookingPending: false,
      offeredSlots: undefined,
    });
    expect(session.disposition).toBe("booked");
    expect(session.state).toBe("awaiting_problem");
  });
});

describe("seedKnownFacts", () => {
  test("uses ROI primary opportunity as initial customerGoal", () => {
    const facts = seedKnownFacts(
      createSession({
        phone: "+15551234567",
        firstName: "Alex",
        businessName: "Test Plumbing",
        annualOpportunity: "$120,000",
        primaryOpportunity: "Missed calls",
        reportUrl: "https://624voice.com/report/test",
        bookingUrl: "https://calendar.app.google/test",
      }),
    );

    expect(facts.customerGoal).toBe("Missed calls");
  });
});
