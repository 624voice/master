import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
import { appendAssistantMessage, appendUserMessage } from "~/server/speed2Lead/memory";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

let consultationSlots: string[] = [];
let bookingCalls = 0;
let availabilityCalls = 0;
let lastBookedStart: string | null = null;

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
    lastBookedStart = input.start;
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

function fridayParts(reference: Date) {
  let candidate = new Date(reference.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const parts = parseCentralParts(candidate, TZ);
    if (parts.weekday === "Fri") {
      return parts;
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  throw new Error("No Friday found");
}

function fridaySlot(hour: number, minute = 0): string {
  const parts = fridayParts(now);
  return centralDateAt(parts.year, parts.month, parts.day, hour, minute, TZ).toISOString();
}

function fridayDateString(): string {
  const parts = fridayParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
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
      primaryPain: "Missed calls",
      fit: "yes",
      questionsAsked: 1,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function emptyModel(): ModelRunner {
  return async () => ({
    output: [{ type: "message" as const, role: "assistant" as const, content: [{ type: "output_text" as const, text: "" }] }],
    outputText: "",
  });
}

function createScriptedModel(
  steps: Array<() => { output: Array<Record<string, unknown>>; outputText: string }>,
): ModelRunner {
  let index = 0;
  return async () => {
    const step = steps[Math.min(index, steps.length - 1)]!;
    index += 1;
    return step() as Awaited<ReturnType<ModelRunner>>;
  };
}

function offersAlternativeTimes(reply: string): boolean {
  const lower = reply.toLowerCase();
  if (!lower.trim()) return false;
  if (/\bgot you booked\b/i.test(lower)) return false;
  return /\b(or|which|option|works best|how about|also have|i have)\b/i.test(lower);
}

beforeEach(() => {
  consultationSlots = [];
  bookingCalls = 0;
  availabilityCalls = 0;
  lastBookedStart = null;
});

describe("exact-time booking end-to-end", () => {
  test("Friday afternoon around 4 then let's do 4 auto-books 4pm without alternatives", async () => {
    const fourPm = fridaySlot(16, 0);
    const threePm = fridaySlot(15, 0);
    consultationSlots = [threePm, fourPm];

    let session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: fridayDateString(),
        partOfDay: "afternoon",
        anchorTimeMinutes: 16 * 60,
      },
    });

    session = appendUserMessage(session, "Around 4");
    const availabilityTurn = await orchestrateInboundTurn(session, "Around 4", {
      runModel: emptyModel(),
      now,
    });
    expect(availabilityTurn.handled).toBe(true);
    if (!availabilityTurn.handled) return;
    expect(availabilityTurn.context.scheduling?.offeredSlots?.length).toBeGreaterThan(0);

    session = appendAssistantMessage(availabilityTurn.context, availabilityTurn.reply);
    const callsBeforeSelection = bookingCalls;
    const availabilityBeforeSelection = availabilityCalls;

    session = appendUserMessage(session, "let's do 4");
    const bookTurn = await orchestrateInboundTurn(session, "let's do 4", {
      runModel: emptyModel(),
      now,
    });

    expect(bookTurn.handled).toBe(true);
    if (!bookTurn.handled) return;
    expect(bookTurn.context.scheduling?.status).toBe("confirmed");
    expect(bookTurn.context.disposition).toBe("booked");
    expect(bookTurn.context.scheduling?.offeredSlots).toBeUndefined();
    expect(bookingCalls).toBe(callsBeforeSelection + 1);
    expect(lastBookedStart).toBe(fourPm);
    expect(offersAlternativeTimes(bookTurn.reply)).toBe(false);
    expect(availabilityCalls).toBe(availabilityBeforeSelection);
  });

  test.each([
    ["I'll take 330 then", 15, 30],
    ["sure 430", 16, 30],
    ["4pm works", 16, 0],
  ])("%s books the matching afternoon slot", async (message, hour, minute) => {
    const target = fridaySlot(hour, minute);
    const other = fridaySlot(hour === 16 ? 15 : 16, minute === 0 ? 30 : 0);
    consultationSlots = [other, target];

    const session = roiSession({
      scheduling: {
        status: "slots_offered",
        centralDate: fridayDateString(),
        partOfDay: "afternoon",
        offeredSlots: [other, target],
      },
    });

    const result = await orchestrateInboundTurn(session, message, {
      runModel: emptyModel(),
      now,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
    expect(lastBookedStart).toBe(target);
    expect(offersAlternativeTimes(result.reply)).toBe(false);
  });

  test("exact 4pm request when available auto-books without offering spread", async () => {
    const fourPm = fridaySlot(16, 0);
    consultationSlots = [fourPm];

    const session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: fridayDateString(),
        partOfDay: "afternoon",
      },
    });

    const result = await orchestrateInboundTurn(session, "Friday at 4pm", {
      runModel: emptyModel(),
      now,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
    expect(lastBookedStart).toBe(fourPm);
    expect(offersAlternativeTimes(result.reply)).toBe(false);
  });
});

describe("post-book acknowledgment end-to-end", () => {
  const bookedStart = fridaySlot(16, 0);

  function bookedSession(): ConversationContext {
    return roiSession({
      disposition: "booked",
      state: "completed",
      scheduling: {
        status: "confirmed",
        selectedStart: bookedStart,
        calendarEventId: "evt-confirmed",
      },
    });
  }

  test.each(["Awesome", "Thanks", "Perfect", "Sounds good"])(
    "%s does not restart scheduling or book again",
    async (message) => {
      bookingCalls = 0;
      availabilityCalls = 0;

      const result = await orchestrateInboundTurn(bookedSession(), message, {
        runModel: async () => ({
          output: [
            {
              type: "message" as const,
              role: "assistant" as const,
              content: [{ type: "output_text" as const, text: "Want to grab another time?" }],
            },
          ],
          outputText: "Want to grab another time?",
        }),
        now,
      });

      expect(result.handled).toBe(true);
      if (!result.handled) return;
      expect(result.context.scheduling?.status).toBe("confirmed");
      expect(bookingCalls).toBe(0);
      expect(availabilityCalls).toBe(0);
      expect(result.context.scheduling?.calendarEventId).toBe("evt-confirmed");
    },
  );
});

describe("LLM failure fallback preserves scheduling state", () => {
  test("active scheduling context survives OpenAI error without restarting discovery", async () => {
    const fourPm = fridaySlot(16, 0);
    consultationSlots = [fourPm];

    const session = roiSession({
      scheduling: {
        status: "slots_offered",
        centralDate: fridayDateString(),
        partOfDay: "afternoon",
        offeredSlots: [fourPm],
        rejectedSlotStarts: ["2026-08-28T20:00:00.000Z"],
      },
      disposition: "active",
    });

    const result = await orchestrateInboundTurn(session, "let's do 4", {
      runModel: async () => {
        throw new Error("OpenAI unavailable");
      },
      now,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling?.centralDate).toBe(fridayDateString());
    expect(result.context.scheduling?.partOfDay).toBe("afternoon");
    expect(result.context.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
  });
  test("LLM book_appointment is blocked when gate plans availability refinement", async () => {
    const slots = [
      centralDateAt(2026, 8, 25, 13, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 25, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 25, 16, 0, TZ).toISOString(),
    ];
    consultationSlots = [
      ...slots,
      centralDateAt(2026, 8, 25, 16, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 25, 17, 0, TZ).toISOString(),
    ];
    bookingCalls = 0;

    const runModel = createScriptedModel([
      () => ({
        output: [
          {
            type: "function_call" as const,
            call_id: "call-book",
            name: "book_appointment",
            arguments: JSON.stringify({ start: slots[0] }),
          },
        ],
        outputText: "",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: slots } }),
      "Do you have anything around 4:30 instead?",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(bookingCalls).toBe(0);
    expect(result.context.scheduling?.status).not.toBe("confirmed");
  });
});

describe("single booking confirmation", () => {
  test("lifecycle SMS suppresses orchestrator duplicate confirmation", async () => {
    const fourPm = fridaySlot(16, 0);
    consultationSlots = [fourPm];

    const session = roiSession({
      scheduling: {
        status: "slots_offered",
        offeredSlots: [fourPm],
        centralDate: fridayDateString(),
        partOfDay: "afternoon",
      },
    });

    const result = await orchestrateInboundTurn(session, "4pm works", {
      runModel: emptyModel(),
      now,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
    expect(result.reply.trim()).toBe("");
  });
});
