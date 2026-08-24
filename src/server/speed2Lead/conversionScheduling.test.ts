import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { formatNaturalTime } from "~/server/appointmentLifecycle/formatTime";
import {
  shouldDeferSchedulingForDiscovery,
  isPostBookingAcknowledgment,
} from "~/server/speed2Lead/conversationDisposition";
import { buildBookingConfirmationMessage } from "~/server/speed2Lead/guardrails";
import {
  computeNextNurtureAt,
  getNextNurtureStage,
  shouldSendNurtureFollowUp,
} from "~/server/speed2Lead/nurtureFollowUp";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingController";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone: "+15551234567",
    firstName: "Chris",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Chris",
      phone: "+15551234567",
      flow: "roi",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("conversion + scheduling behavior classes", () => {
  test("natural time formatting uses compact am/pm", () => {
    const nine = centralDateAt(2026, 8, 26, 9, 0, TZ).toISOString();
    const fourThirty = centralDateAt(2026, 8, 26, 16, 30, TZ).toISOString();
    expect(formatNaturalTime(nine, TZ).time).toBe("9am");
    expect(formatNaturalTime(fourThirty, TZ).time).toBe("4:30pm");
  });

  test("uncertain pain defers strong-interest scheduling", () => {
    expect(shouldDeferSchedulingForDiscovery(roiSession(), "Not sure really")).toBe(true);
    expect(
      shouldDeferSchedulingForDiscovery(
        roiSession({
          knownFacts: {
            ...roiSession().knownFacts!,
            primaryPain: "Missed calls",
            questionsAsked: 1,
          },
        }),
        "Yeah let's talk",
      ),
    ).toBe(false);
  });

  test("day only asks part of day not full preference loop", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Yeah let's talk",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, fit: "yes" },
        scheduling: { status: "idle", centralDate: "2026-08-28" },
      }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
  });

  test("confirmed booking blocks further scheduling", () => {
    const plan = planSchedulingGate({
      inboundMessage: "How about tomorrow",
      context: roiSession({
        scheduling: {
          status: "confirmed",
          selectedStart: centralDateAt(2026, 8, 28, 16, 0, TZ).toISOString(),
          calendarEventId: "evt-1",
        },
        disposition: "booked",
      }),
      now,
    });
    expect(plan.action.type).toBe("none");
    expect(plan.schedulingIntent).toBe(false);
  });

  test("exact time request plans targeted availability lookup", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Friday at 4pm",
      context: roiSession({
        scheduling: { status: "idle", centralDate: "2026-08-28", partOfDay: "afternoon" },
      }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
    expect(plan.action.type === "get_availability_for_request" && plan.action.reason).toBe(
      "exact_time_request",
    );
  });

  test("post-booking acknowledgment is recognized", () => {
    expect(isPostBookingAcknowledgment("Thanks!")).toBe(true);
    expect(isPostBookingAcknowledgment("Can we move it?")).toBe(false);
  });

  test("booking confirmation mentions date, time, timezone, and Meet link when available", () => {
    const start = centralDateAt(2026, 8, 28, 16, 0, TZ).toISOString();
    const message = buildBookingConfirmationMessage(start, "Chris", {
      email: "chris@example.com",
      sendsCalendarInvite: false,
      useLifecycleCopy: false,
      meetingLink: "https://meet.google.com/test-abc-defg-hij",
    });
    expect(message.toLowerCase()).toContain("friday");
    expect(message).toContain("4pm");
    expect(message).toContain("CT");
    expect(message.toLowerCase()).toContain("booked");
    expect(message).toContain("Google Meet link:");
    expect(message).toContain("https://meet.google.com/test-abc-defg-hij");
    expect(message).not.toMatch(/email(ed)? you a calendar invite/i);
  });
});

describe("ROI/contact nurture follow-up", () => {
  test("advances through three stages", () => {
    expect(getNextNurtureStage(0)).toBe(1);
    expect(getNextNurtureStage(1)).toBe(2);
    expect(getNextNurtureStage(2)).toBe(3);
    expect(getNextNurtureStage(3)).toBeNull();
  });

  test("does not send when customer has replied", () => {
    const session = roiSession({
      nurtureStage: 0,
      nurtureNextAt: new Date(now.getTime() - 1000).toISOString(),
      nurtureStartedAt: now.toISOString(),
      messages: [{ role: "user", content: "Hey", at: now.toISOString() }],
    });
    expect(shouldSendNurtureFollowUp(session, now)).toBe(false);
  });

  test("computes later business-day follow-ups", () => {
    const session = roiSession({
      nurtureStartedAt: now.toISOString(),
    });
    expect(computeNextNurtureAt(session, 2)).toBeTruthy();
    expect(computeNextNurtureAt(session, 3)).toBeTruthy();
  });
});
