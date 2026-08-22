import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { readFileSync } from "node:fs";
import {
  allowCalendarLinkFallback,
  planSchedulingGate,
  resolveOfferedSlotSelection,
} from "~/server/speed2Lead/schedulingController";
import { prepareInboundSchedulingTurn } from "~/server/speed2Lead/schedulingIntent";
import {
  inferAvailabilityInputFromMessage,
  resolveLaterThisWeekRange,
} from "~/server/speed2Lead/schedulingRange";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import type { ConversationContext } from "~/server/speed2Lead/types";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
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
      customerGoal: "Missed calls",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function contactSession(overrides: Partial<ContactConversationContext> = {}): ContactConversationContext {
  return {
    flow: "contact",
    phone: "+15551234567",
    firstName: "Sam",
    businessName: "Sam HVAC",
    shortNeedSummary: "We miss calls after hours and need help responding faster",
    relevantSolution: "AI lead response",
    relevantLink: "https://624voice.com",
    relevantExample: "Example",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_prompt",
    messages: [],
    knownFacts: {
      firstName: "Sam",
      phone: "+15551234567",
      flow: "contact",
      businessName: "Sam HVAC",
      customerGoal: "We miss calls after hours and need help responding faster",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("schedulingController planning", () => {
  test("Yeah let's talk plans a scheduling preference question", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Yeah let's talk",
      context: roiSession(),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
    expect(plan.schedulingIntent).toBe(true);
  });

  test("Tuesday afternoon forces availability lookup", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Tuesday afternoon",
      context: roiSession(),
      now,
    });
    expect(plan.action.type).toBe("get_availability");
    expect(plan.preferenceInput?.centralDate || plan.preferenceInput?.rangeStart).toBeTruthy();
  });

  test("Thursday morning forces availability lookup", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Thursday morning",
      context: roiSession(),
      now,
    });
    expect(plan.action.type).toBe("get_availability");
    expect(inferAvailabilityInputFromMessage("Thursday morning", now)?.centralDate).toBeTruthy();
  });

  test("Later this week produces a valid range and availability lookup", () => {
    const range = resolveLaterThisWeekRange(now);
    const plan = planSchedulingGate({
      inboundMessage: "Later this week",
      context: roiSession(),
      now,
    });
    expect(plan.action.type).toBe("get_availability");
    expect(range.rangeEnd.getTime()).toBeGreaterThan(range.rangeStart.getTime());
  });

  test("Contact strong-interest with day preference plans availability lookup", () => {
    const plan = planSchedulingGate({
      inboundMessage: "I'm interested — Tuesday afternoon works",
      context: contactSession(),
      now,
    });
    expect(plan.action.type).toBe("get_availability");
  });

  test("ROI fast-conversion path plans scheduling preference instead of discovery", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Yes, let's talk",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, urgency: "high", fit: "yes" },
      }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
  });

  test("Calendar link cannot be allowed merely because no tool was called", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Yeah let's talk",
      context: roiSession(),
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: createInitialToolState(),
      }),
    ).toBe(false);
  });

  test("Calendar link is not allowed without provider failure after empty availability", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Tuesday afternoon",
      context: roiSession(),
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: { ...createInitialToolState(), availabilityAttempts: 2, offeredSlots: [] },
      }),
    ).toBe(false);
  });

  test("Calendar link is allowed after repeated provider failures", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Tuesday afternoon",
      context: roiSession(),
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: {
          ...createInitialToolState(),
          calendarUnavailable: true,
          providerFailureReason: "calendar_api_error",
          availabilityAttempts: 2,
          offeredSlots: [],
        },
      }),
    ).toBe(true);
  });

  test("Calendar link blocked when application logic failure is flagged", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Afternoon",
      context: roiSession({
        scheduling: {
          status: "idle",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          applicationLogicFailure: true,
        },
      }),
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: {
          ...createInitialToolState(),
          calendarUnavailable: true,
          availabilityAttempts: 3,
          offeredSlots: [],
        },
        context: roiSession({
          scheduling: {
            status: "idle",
            centralDate: "2026-08-26",
            partOfDay: "afternoon",
            applicationLogicFailure: true,
          },
        }),
      }),
    ).toBe(false);
  });

  test("known date + afternoon please plans availability without ask", () => {
    const context = prepareInboundSchedulingTurn(
      roiSession({ scheduling: { status: "idle", centralDate: "2026-08-29" } }),
      "Let's do afternoon please",
      now,
    );
    const plan = planSchedulingGate({
      inboundMessage: "Let's do afternoon please",
      context,
      now,
    });
    expect(plan.action.type).toBe("get_availability");
    expect(plan.action.type === "get_availability" && plan.action.input.partOfDay).toBe("afternoon");
  });

  test("Selecting an offered slot plans booking", () => {
    const slot = centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString();
    const plan = planSchedulingGate({
      inboundMessage: "1:30 works",
      context: roiSession({ scheduling: { status: "slots_offered", offeredSlots: [slot] } }),
      now,
    });
    expect(plan.action.type).toBe("book_appointment");
  });

  test("the second one resolves against offered slots", () => {
    const slots = [
      centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 30, TZ).toISOString(),
    ];
    expect(resolveOfferedSlotSelection("the second one", slots)).toBe(slots[1]);
  });

  test("Requested non-offered time plans fresh availability lookup", () => {
    const offered = centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString();
    const plan = planSchedulingGate({
      inboundMessage: "Thursday morning instead",
      context: roiSession({ scheduling: { status: "slots_offered", offeredSlots: [offered] } }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
  });

  test("around 4:30 instead does not select closest offered slot", () => {
    const slots = [
      centralDateAt(2026, 8, 26, 13, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];
    expect(resolveOfferedSlotSelection("Do you have anything around 4:30 instead?", slots)).toBeNull();
    const plan = planSchedulingGate({
      inboundMessage: "Do you have anything around 4:30 instead?",
      context: roiSession({ scheduling: { status: "slots_offered", offeredSlots: slots } }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
    expect(plan.action.type === "get_availability_for_request" && plan.action.input.centralDate).toBeTruthy();
  });

  test("2pm slot works still selects exact offered slot", () => {
    const slots = [
      centralDateAt(2026, 8, 26, 13, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
    ];
    expect(resolveOfferedSlotSelection("The 2pm slot works", slots)).toBe(slots[1]);
  });

  test("Existing STOP/lifecycle routing remains unchanged", () => {
    const handleInboundSource = readFileSync(
      new URL("./handleInbound.ts", import.meta.url),
      "utf8",
    );
    const stopIndex = handleInboundSource.indexOf('intent === "stop"');
    const llmIndex = handleInboundSource.indexOf("shouldUseSpeed2LeadLlmForPhone(phone)");
    const lifecycleIndex = handleInboundSource.indexOf("handleAppointmentLifecycleInbound");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(llmIndex).toBeGreaterThan(stopIndex);
    expect(lifecycleIndex).toBeGreaterThan(-1);
    expect(llmIndex).toBeGreaterThan(lifecycleIndex);
  });
});
