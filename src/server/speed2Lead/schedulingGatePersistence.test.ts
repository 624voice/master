import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { readFileSync } from "node:fs";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);
let consultationSlots: string[] = [];
let bookingResult: {
  ok: boolean;
  eventId?: string;
  selectedStart?: string;
  reason?: string;
} = { ok: true, eventId: "evt-1", selectedStart: "" };

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    const startMs = new Date(input.rangeStart).getTime();
    return {
      ok: true,
      slots: consultationSlots.filter((slot) => {
        const ms = new Date(slot).getTime();
        return ms >= startMs && ms <= new Date(input.rangeEnd).getTime();
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
    if (!bookingResult.ok) {
      return { ok: false, reason: bookingResult.reason ?? "slot_unavailable" };
    }
    return {
      ok: true,
      eventId: bookingResult.eventId ?? "evt-1",
      selectedStart: bookingResult.selectedStart ?? input.start,
      replayed: false,
      lifecycle: { action: "created", smsSent: true },
    };
  },
}));

const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");
const {
  allowCalendarLinkFallback,
  isActiveV2Scheduling,
  planSchedulingGate,
  resolveOfferedSlotSelection,
  schedulingRequestKey,
} = await import("~/server/speed2Lead/schedulingController");
const { createInitialToolState } = await import("~/server/speed2Lead/tools");
const { validateOutboundSms } = await import("~/server/speed2Lead/guardrails");

function tuesdaySlots(reference: Date): string[] {
  let candidate = new Date(reference.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const parts = parseCentralParts(candidate, TZ);
    if (parts.weekday === "Tue") {
      return [13, 14, 16].map((hour) =>
        centralDateAt(parts.year, parts.month, parts.day, hour, 0, TZ).toISOString(),
      );
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  throw new Error("no tuesday");
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

function textOutput(text: string) {
  return [{ type: "message" as const, role: "assistant" as const, content: [{ type: "output_text" as const, text }] }];
}

function createScriptedModel(
  steps: Array<() => { output: ReturnType<typeof textOutput>; outputText: string }>,
): ModelRunner {
  let index = 0;
  return async () => {
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    return step();
  };
}

beforeEach(() => {
  consultationSlots = tuesdaySlots(now);
  bookingResult = { ok: true, eventId: "evt-1", selectedStart: "", replayed: false };
});

afterEach(() => {
  consultationSlots = [];
});

describe("scheduling gate persistence", () => {
  test("availability succeeds with empty LLM reply sends deterministic slot offer", async () => {
    const runModel = createScriptedModel([
      () => ({ output: textOutput(""), outputText: "" }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Tuesday afternoon", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("slots_offered");
    expect(result.context.scheduling.offeredSlots?.length).toBeGreaterThan(0);
    expect(result.reply.toLowerCase()).toMatch(/any of those work|open|works|available|still available/);
  });

  test("availability succeeds with invalid LLM slot draft sends deterministic slot offer", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput("I can do 1:30, 2:30, or 5:15 Tuesday."),
        outputText: "I can do 1:30, 2:30, or 5:15 Tuesday.",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Tuesday afternoon", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).not.toContain("5:15");
    expect(result.context.scheduling.offeredSlots?.length).toBeGreaterThan(0);
  });

  test("preference gate with invalid LLM draft sends deterministic preference question", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput("Great, let's find a time that works for you soon."),
        outputText: "Great, let's find a time that works for you soon.",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Yeah let's talk", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).toMatch(/what day|morning|afternoon/);
  });

  test("booking succeeds with invalid LLM draft sends truthful confirmation", async () => {
    const slots = tuesdaySlots(now);
    const slot = slots[1]!;
    bookingResult = { ok: true, eventId: "evt-book", selectedStart: slot };

    const runModel = createScriptedModel([
      () => ({
        output: textOutput("You're booked for 2:30 PM CT."),
        outputText: "You're booked for 2:30 PM CT.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: slots } }),
      "2:30 works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("confirmed");
    expect(result.reply.trim()).toBe("");
  });

  test("conflict refresh with invalid LLM draft sends refreshed slots", async () => {
    const slots = tuesdaySlots(now);
    const taken = slots[1]!;
    const alt = slots[2]!;
    consultationSlots = slots;
    bookingResult = { ok: false, reason: "slot_unavailable" };

    const runModel = createScriptedModel([
      () => ({
        output: textOutput("You're all set for 2:30 PM."),
        outputText: "You're all set for 2:30 PM.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: [taken] } }),
      "2pm works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).toContain("taken");
    expect(result.context.scheduling.status).toBe("slots_offered");
  });

  test("offered slots persist across prior forced reply turn for next selection", async () => {
    const slots = tuesdaySlots(now);
    consultationSlots = slots;
    bookingResult = { ok: true, eventId: "evt-2", selectedStart: slots[1] };

    const turn1 = await orchestrateInboundTurn(
      roiSession(),
      "Tuesday afternoon",
      {
        runModel: createScriptedModel([
          () => ({
            output: textOutput("I can do 1:30, 2:30, or 4:00 Tuesday."),
            outputText: "I can do 1:30, 2:30, or 4:00 Tuesday.",
          }),
        ]),
        now,
      },
    );
    expect(turn1.handled).toBe(true);
    if (!turn1.handled) return;
    expect(turn1.context.scheduling.offeredSlots?.length).toBeGreaterThan(0);

    const turn2 = await orchestrateInboundTurn(
      turn1.context,
      "the second one",
      {
        runModel: createScriptedModel([
          () => ({ output: textOutput("Perfect."), outputText: "Perfect." }),
        ]),
        now,
      },
    );

    expect(turn2.handled).toBe(true);
    if (!turn2.handled) return;
    expect(turn2.context.scheduling.status).toBe("confirmed");
  });

  test("changing preferred day resets stale attempt counters", () => {
    const tuesdayKey = schedulingRequestKey({
      centralDate: "2026-08-26",
      partOfDay: "afternoon",
    });
    const fridayKey = schedulingRequestKey({
      centralDate: "2026-08-29",
      partOfDay: "morning",
    });
    expect(tuesdayKey).not.toBe(fridayKey);

    const plan = planSchedulingGate({
      inboundMessage: "Friday morning instead",
      context: roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: tuesdaySlots(now),
          activeRequestKey: tuesdayKey,
          availabilityAttempts: 2,
        },
      }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
  });

  test("successful availability resets failed attempt counter for calendar fallback", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Tuesday afternoon",
      context: roiSession(),
      now,
    });
    const toolState = {
      ...createInitialToolState(),
      availabilityAttempts: 2,
      offeredSlots: consultationSlots,
    };
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: { ...toolState, availabilityAttempts: 0 },
      }),
    ).toBe(false);
  });

  test("repeated provider failure for same request can allow calendar link", () => {
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

  test("empty availability without provider failure does not allow calendar link", () => {
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

  test("yes the 2pm one resolves against refreshed offered slots", () => {
    const slots = tuesdaySlots(now);
    expect(resolveOfferedSlotSelection("Yes the 2pm one", slots)).toBe(slots[1]);
  });

  test("active V2 scheduling blocks rules fallback path in handleInbound", () => {
    const source = readFileSync(new URL("./handleInbound.ts", import.meta.url), "utf8");
    expect(source).toContain("isActiveV2Scheduling");
    expect(source.indexOf("isActiveV2Scheduling")).toBeLessThan(
      source.indexOf("advanceDemoConversation"),
    );
  });

  test("stale slot times fail guardrail after refresh", () => {
    const slots = tuesdaySlots(now);
    const refreshed = [slots[2]!];
    const staleReply = `That time just got taken — I can do 2:00 PM. Does that work?`;
    const validation = validateOutboundSms(staleReply, {
      session: roiSession({ scheduling: { status: "slots_offered", offeredSlots: refreshed } }),
      toolState: { ...createInitialToolState(), offeredSlots: refreshed },
    });
    expect(validation.ok).toBe(false);
  });

  test("non-offered time request does not confirm booking", async () => {
    const slots = tuesdaySlots(now);
    consultationSlots = [...slots, centralDateAt(2026, 8, 26, 16, 30, TZ).toISOString(), centralDateAt(2026, 8, 26, 17, 0, TZ).toISOString()];
    bookingResult = { ok: true, eventId: "evt-should-not-book", selectedStart: "" };

    const turn1 = await orchestrateInboundTurn(
      roiSession(),
      "Tuesday afternoon",
      {
        runModel: createScriptedModel([
          () => ({
            output: textOutput("I can do 1:00 PM, 2:00 PM, or 4:00 PM Tuesday."),
            outputText: "I can do 1:00 PM, 2:00 PM, or 4:00 PM Tuesday.",
          }),
        ]),
        now,
      },
    );
    expect(turn1.handled).toBe(true);
    if (!turn1.handled) return;

    const turn2 = await orchestrateInboundTurn(
      turn1.context,
      "Do you have anything around 4:30 instead?",
      {
        runModel: createScriptedModel([
          () => ({
            output: textOutput("You're all set for 4:00 PM CT, Alex."),
            outputText: "You're all set for 4:00 PM CT, Alex.",
          }),
        ]),
        now,
      },
    );

    expect(turn2.handled).toBe(true);
    if (!turn2.handled) return;
    expect(turn2.context.scheduling.status).not.toBe("confirmed");
    expect(turn2.reply.toLowerCase()).not.toMatch(/all set|booked|you're set/);
    expect(turn2.reply.toLowerCase()).toMatch(/any of those work|open|around then|works|available|could work|closer to that/);
  });

  test("isActiveV2Scheduling detects offered slots", () => {
    expect(
      isActiveV2Scheduling(
        roiSession({ scheduling: { status: "slots_offered", offeredSlots: tuesdaySlots(now) } }),
      ),
    ).toBe(true);
  });
});
