import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildSchedulingCustomerQuestionReply,
  detectSchedulingCustomerQuestion,
} from "~/server/speed2Lead/customerQuestions";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);

function session(overrides: Partial<ConversationContext> = {}): ConversationContext {
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
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone: "+15551234567",
      flow: "roi",
      businessName: "Test Plumbing",
      questionsAsked: 0,
      meetingInterestConfirmed: true,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("scheduling customer questions", () => {
  test("date confirmation detects and answers affirmatively", () => {
    const ctx = session({
      scheduling: {
        status: "slots_offered",
        centralDate: "2026-08-27",
        partOfDay: "morning",
        offeredSlots: [centralDateAt(2026, 8, 27, 9, 0, TZ).toISOString()],
      },
    });
    expect(detectSchedulingCustomerQuestion("We're talking about the 27th right?", ctx)).toBe(
      "date_confirm",
    );
    const reply = buildSchedulingCustomerQuestionReply({
      kind: "date_confirm",
      context: ctx,
      toolState: createInitialToolState(),
      inboundMessage: "We're talking about the 27th right?",
    });
    expect(reply?.toLowerCase()).toMatch(/yes.*thursday.*27/);
  });

  test("what time repeats offered slots without resetting", () => {
    const slots = [
      centralDateAt(2026, 8, 27, 9, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 27, 10, 30, TZ).toISOString(),
    ];
    const ctx = session({
      scheduling: { status: "slots_offered", centralDate: "2026-08-27", offeredSlots: slots },
    });
    expect(detectSchedulingCustomerQuestion("What time?", ctx)).toBe("what_time");
    const reply = buildSchedulingCustomerQuestionReply({
      kind: "what_time",
      context: ctx,
      toolState: { ...createInitialToolState(), offeredSlots: slots },
      inboundMessage: "What time?",
    });
    expect(reply?.toLowerCase()).toMatch(/9:00|10:30/);
  });

  test("meet link returns persisted URL when booked", () => {
    const start = centralDateAt(2026, 8, 27, 10, 30, TZ).toISOString();
    const ctx = session({
      scheduling: {
        status: "confirmed",
        selectedStart: start,
        calendarEventId: "evt-1",
        googleMeetUrl: "https://meet.google.com/abc-defg-hij",
      },
    });
    expect(detectSchedulingCustomerQuestion("Is there a meeting link?", ctx)).toBe("meet_link");
    const reply = buildSchedulingCustomerQuestionReply({
      kind: "meet_link",
      context: ctx,
      toolState: createInitialToolState(),
      inboundMessage: "Is there a meeting link?",
    });
    expect(reply).toContain("https://meet.google.com/abc-defg-hij");
  });
});
