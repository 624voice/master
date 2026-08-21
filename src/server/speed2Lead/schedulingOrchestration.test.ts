import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
import { appendUserMessage } from "~/server/speed2Lead/memory";
import {
  classifySchedulingTimeIntent,
  resolveBareHourSelectionMinutes,
  resolveOfferedSlotSelectionCandidate,
} from "~/server/speed2Lead/schedulingContext";
import {
  planSchedulingGate,
  requiresDeterministicSchedulingCompletion,
  resolveOfferedSlotSelection,
} from "~/server/speed2Lead/schedulingController";
import { validateOutboundSms } from "~/server/speed2Lead/guardrails";
import { rankSlotsForOffer } from "~/server/speed2Lead/slotRanking";
import { shouldSuggestCalendarLink, createInitialToolState } from "~/server/speed2Lead/tools";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

let consultationSlots: string[] = [];
let bookingCalls = 0;
let availabilityCalls = 0;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    availabilityCalls += 1;
    const startMs = new Date(input.rangeStart).getTime();
    const endMs = new Date(input.rangeEnd).getTime();
    return {
      ok: true,
      slots: consultationSlots.filter((slot) => {
        const ms = new Date(slot).getTime();
        return ms >= startMs && ms <= endMs;
      }),
    };
  },
  fetchCalendarEventsUpdatedSince: async () => [],
  cancelCalendarEvent: async () => false,
  resetGoogleTokenCacheForTests: () => {},
  calendarAttendeeInviteEnabled: (email?: string) => Boolean(email),
}));

mock.module("~/server/appointmentLifecycle/bookConsultation", () => ({
  bookConsultation: async (input: { start: string }) => {
    bookingCalls += 1;
    return {
      ok: true,
      eventId: `evt-${bookingCalls}`,
      selectedStart: input.start,
      replayed: false,
      lifecycle: { action: "created", smsSent: true },
    };
  },
}));

const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");

function wednesdaySlots() {
  return [14, 15, 16].map((hour) =>
    centralDateAt(2026, 8, 26, hour, 0, TZ).toISOString(),
  );
}

function wednesdayAfternoonNearThree() {
  return [14, 15, 16].map((hour, index) =>
    centralDateAt(2026, 8, 26, hour, index === 1 ? 0 : index === 0 ? 45 : 15, TZ).toISOString(),
  );
}

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
    updatedAt: now.toISOString(),
    knownFacts: {
      firstName: "Alex",
      phone: "+15551234567",
      flow: "roi",
      questionsAsked: 2,
    },
    ...overrides,
  };
}

function silentModel(): ModelRunner {
  return async () => ({ output: [], outputText: "" });
}

function toxicModel(reply: string): ModelRunner {
  return async () => ({ output: [], outputText: reply });
}

describe("scheduling orchestration invariants", () => {
  beforeEach(() => {
    consultationSlots = [];
    bookingCalls = 0;
    availabilityCalls = 0;
  });

  test("no date means no availability action", () => {
    const plan = planSchedulingGate({
      inboundMessage: "What times do you have?",
      context: roiSession(),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
    expect(requiresDeterministicSchedulingCompletion(plan, roiSession())).toBe(false);
  });

  test("day supplied without daypart asks morning or afternoon", () => {
    let session = roiSession();
    const dayPlan = planSchedulingGate({
      inboundMessage: "How about next Wednesday",
      context: session,
      now,
    });
    expect(dayPlan.action.type).toBe("ask_preference");

    session = {
      ...session,
      scheduling: {
        status: "idle",
        centralDate: "2026-08-26",
      },
    };
    const partPlan = planSchedulingGate({
      inboundMessage: "Afternoon",
      context: session,
      now,
    });
    expect(partPlan.action.type).toBe("get_availability");
    if (partPlan.action.type === "get_availability") {
      expect(partPlan.action.input.partOfDay).toBe("afternoon");
    }
  });

  test("afternoon filter excludes morning slots", () => {
    const all = [
      centralDateAt(2026, 8, 26, 10, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 0, TZ).toISOString(),
    ];
    const ranked = rankSlotsForOffer(all, { partOfDay: "afternoon", maxOffer: 3 });
    expect(ranked.every((slot) => new Date(slot).getUTCHours() >= 17)).toBe(true);
  });

  test("exact anchor returns only the exact slot when available", () => {
    const slots = wednesdayAfternoonNearThree();
    const ranked = rankSlotsForOffer(slots, {
      anchorMinutes: 15 * 60,
      narrowAroundAnchor: true,
      maxOffer: 3,
    });
    expect(ranked).toHaveLength(1);
    expect(new Date(ranked[0]!).getUTCHours()).toBe(20);
  });

  test("3 is good resolves to offered 3pm slot", () => {
    const slots = wednesdayAfternoonNearThree();
    const selected = resolveOfferedSlotSelection("3 is good", slots);
    expect(selected).toBe(slots[1]);
    expect(classifySchedulingTimeIntent("3 is good", { status: "slots_offered", offeredSlots: slots })).toBe(
      "select",
    );
  });

  test("what about 3 is a request not a selection", () => {
    const slots = wednesdayAfternoonNearThree();
    expect(classifySchedulingTimeIntent("What about 3?", { status: "slots_offered", offeredSlots: slots })).toBe(
      "request",
    );
    expect(resolveOfferedSlotSelectionCandidate("What about 3?", slots)).toBeNull();
  });

  test("pending-work and exact-phrase replies are blocked by guardrails", () => {
    const toolState = createInitialToolState();
    toolState.offeredSlots = wednesdaySlots();
    const pending = validateOutboundSms("Got it — booking that now.", {
      session: roiSession({ scheduling: { status: "slots_offered", offeredSlots: toolState.offeredSlots } }),
      toolState,
    });
    expect(pending.ok).toBe(false);

    const exactPhrase = validateOutboundSms(
      'Please reply with exactly "Yes, book 3pm Wednesday" to finalize your appointment.',
      { session: roiSession(), toolState },
    );
    expect(exactPhrase.ok).toBe(false);
  });

  test("calendar link blocked while live scheduling has offered slots", () => {
    const state = createInitialToolState();
    state.offeredSlots = wednesdaySlots();
    state.bookingAttempts = 3;
    expect(shouldSuggestCalendarLink(state)).toBe(false);
  });

  test("calendar link allowed when calendar unavailable", () => {
    const state = createInitialToolState();
    state.calendarUnavailable = true;
    expect(shouldSuggestCalendarLink(state)).toBe(true);
  });
});

describe("live phone regression: test 3 wednesday 3pm booking", () => {
  beforeEach(() => {
    consultationSlots = wednesdayAfternoonNearThree();
    bookingCalls = 0;
    availabilityCalls = 0;
  });

  test("3 is good books immediately without follow-up SMS", async () => {
    const slots = wednesdayAfternoonNearThree();
    let session = roiSession({
      scheduling: {
        status: "slots_offered",
        offeredSlots: slots,
        centralDate: "2026-08-26",
        partOfDay: "afternoon",
        anchorTimeMinutes: 15 * 60,
      },
    });
    session = appendUserMessage(session, "3 is good");

    const result = await orchestrateInboundTurn(session, "3 is good", {
      now,
      runModel: toxicModel(
        'Please reply with exactly "Yes, book 3pm Wednesday" to finalize your appointment.',
      ),
    });

    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.context.scheduling?.status).toBe("confirmed");
      expect(bookingCalls).toBe(1);
      expect(result.reply).not.toMatch(/booking that now/i);
      expect(result.reply).not.toMatch(/reply with exactly/i);
      expect(result.reply).not.toMatch(/confirm you want/i);
    }
  });
});

describe("live phone regression: test 2 day-before-slots", () => {
  test("availability question without day asks for day first", () => {
    const plan = planSchedulingGate({
      inboundMessage: "What do you have open this week?",
      context: roiSession({ knownFacts: { firstName: "Alex", phone: "+15551234567", flow: "roi", questionsAsked: 2, fit: "yes" } }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
    expect(plan.action.type === "get_availability").toBe(false);
  });
});

describe("live phone regression: test 1 calendar link fallback", () => {
  test("healthy scheduling with slots does not suggest calendar link", async () => {
    consultationSlots = wednesdaySlots();
    let session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: "2026-08-26",
        partOfDay: "afternoon",
      },
    });
    session = appendUserMessage(session, "Afternoon works");

    const result = await orchestrateInboundTurn(session, "Afternoon works", {
      now,
      runModel: toxicModel("Easiest may be my calendar link: https://calendar.app.google/test"),
    });

    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply).not.toMatch(/calendar\.app\.google/i);
      expect(result.context.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("resolveBareHourSelectionMinutes", () => {
  test("parses bare hour selections", () => {
    const slots = wednesdayAfternoonNearThree();
    expect(resolveBareHourSelectionMinutes("3 is good", slots)).toBe(15 * 60);
    expect(resolveBareHourSelectionMinutes("Sure 430", slots)).toBe(16 * 60 + 30);
  });
});
