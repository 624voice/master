import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
import { appendAssistantMessage, appendUserMessage } from "~/server/speed2Lead/memory";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetCapturedOutboundSms,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

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

mock.module("~/server/appointmentLifecycle/handleInbound", () => ({
  handleAppointmentLifecycleInbound: async () => ({ handled: false, sessionPersisted: false }),
}));

mock.module("~/server/speed2Lead/transcript", () => ({
  logSmsTranscriptSafely: () => {},
}));

const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");
const { handleInboundSms } = await import("~/server/speed2Lead/handleInbound");
const { saveSession, clearSession, getSession } = await import("~/server/speed2Lead/session");

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
      meetingBridgeComplete: true,
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

describe("deployed Twilio inbound path", () => {
  const deployedNow = centralDateAt(2026, 8, 20, 10, 0, TZ);
  const deployedPhone = "+15559876543";

  function deployedTomorrow(): string {
    const parts = parseCentralParts(new Date(deployedNow.getTime() + 86400000), TZ);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  function deployedSlot(date: string, hour: number, minute = 0): string {
    const [year, month, day] = date.split("-").map(Number);
    return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
  }

  function deployedSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
    return {
      ...roiSession(overrides),
      phone: deployedPhone,
      orchestratorManagedQuestions: true,
    };
  }

  function calendarLinkModel(): ModelRunner {
    return async () => ({
      output: [
        {
          type: "message" as const,
          role: "assistant" as const,
          content: [
            {
              type: "output_text" as const,
              text: "Grab a time here: https://calendar.app.google/test",
            },
          ],
        },
      ],
      outputText: "Grab a time here: https://calendar.app.google/test",
    });
  }

  async function runDeployed(inbound: string, session: ConversationContext, model: ModelRunner = emptyModel()) {
    resetSpeed2LeadIntegrationMocks();
    bookingCalls = 0;
    lastBookedStart = null;
    availabilityCalls = 0;
    await clearSession(deployedPhone);
    await saveSession({ ...session, phone: deployedPhone });
    resetCapturedOutboundSms();
    await handleInboundSms(deployedPhone, inbound, { now: deployedNow, runModel: model });
    return getSession(deployedPhone);
  }

  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
    process.env.OPENAI_API_KEY = "test-key";
    resetSpeed2LeadTestPhonesCacheForTests();
  });

  test("pain identified does not send premature self-scheduling link", async () => {
    await runDeployed(
      "We miss calls all day",
      deployedSession({
        knownFacts: {
          firstName: "Alex",
          phone: deployedPhone,
          flow: "roi",
          businessName: "Test Plumbing",
          customerGoal: "Missed calls",
          primaryPain: "Missed calls",
          fit: "yes",
          questionsAsked: 1,
        },
      }),
      calendarLinkModel(),
    );
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.includes("calendar.app.google")).toBe(false);
  });

  test("no date means no slot offer through handleInbound", async () => {
    consultationSlots = [deployedSlot(deployedTomorrow(), 14, 0)];
    await runDeployed("What times do you have?", deployedSession());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/day|morning|afternoon/);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b1:00|\b2:00|\b1pm|\b2pm/);
  });

  test("day only asks morning or afternoon through handleInbound", async () => {
    await runDeployed("How about tomorrow", deployedSession());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/morning|afternoon/);
  });

  test("tomorrow afternoon returns only afternoon slots through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    consultationSlots = [
      deployedSlot(tomorrow, 10, 30),
      deployedSlot(tomorrow, 13, 45),
      deployedSlot(tomorrow, 15, 0),
    ];

    await runDeployed("I can do tomorrow afternoon", deployedSession());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b10:30|\b11:/);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/1:45|3:00|3pm/);
  });

  test("explicit afternoon correction excludes morning slots through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    consultationSlots = [
      deployedSlot(tomorrow, 10, 0),
      deployedSlot(tomorrow, 14, 0),
      deployedSlot(tomorrow, 16, 0),
    ];

    await runDeployed(
      "Afternoon please",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "morning",
          offeredSlots: [deployedSlot(tomorrow, 10, 0)],
        },
      }),
    );

    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b10:00|\b10am|\b11:/);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/2:00|4:00|2pm|4pm/);
  });

  test("repeated afternoon correction does not reuse stale morning slots", async () => {
    const tomorrow = deployedTomorrow();
    const morningSlot = deployedSlot(tomorrow, 10, 0);
    const afternoonSlot = deployedSlot(tomorrow, 15, 0);
    consultationSlots = [morningSlot, afternoonSlot];

    await runDeployed(
      "Actually afternoon",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "morning",
          offeredSlots: [morningSlot],
        },
      }),
    );

    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b10:00|\b10am/);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/3:00|3pm/);
  });

  test("exact requested available time books directly through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const fourPm = deployedSlot(tomorrow, 16, 0);
    consultationSlots = [fourPm];

    const updated = await runDeployed(
      "Tomorrow at 4pm works",
      deployedSession({
        scheduling: {
          status: "idle",
          centralDate: tomorrow,
          partOfDay: "afternoon",
        },
      }),
    );

    expect(bookingCalls).toBe(1);
    expect(lastBookedStart).toBe(fourPm);
    expect(updated?.scheduling?.status).toBe("confirmed");
    expect(capturedOutboundSms.length).toBeLessThanOrEqual(1);
  });

  test("clear yep after single offered slot books through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const fourPm = deployedSlot(tomorrow, 16, 0);
    consultationSlots = [fourPm];

    const updated = await runDeployed(
      "Yep",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "afternoon",
          offeredSlots: [fourPm],
        },
      }),
    );

    expect(bookingCalls).toBe(1);
    expect(lastBookedStart).toBe(fourPm);
    expect(updated?.scheduling?.status).toBe("confirmed");
  });

  test("multi-slot offer with explicit selected time books through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const twoPm = deployedSlot(tomorrow, 14, 0);
    const fourPm = deployedSlot(tomorrow, 16, 0);
    consultationSlots = [twoPm, fourPm];

    const updated = await runDeployed(
      "4pm works",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "afternoon",
          offeredSlots: [twoPm, fourPm],
        },
      }),
    );

    expect(bookingCalls).toBe(1);
    expect(lastBookedStart).toBe(fourPm);
    expect(updated?.scheduling?.status).toBe("confirmed");
  });

  test("changed constraints invalidate prior offered slot set through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const morningSlot = deployedSlot(tomorrow, 10, 0);
    const afternoonSlot = deployedSlot(tomorrow, 15, 0);
    consultationSlots = [morningSlot, afternoonSlot];

    await runDeployed(
      "Tomorrow afternoon instead",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "morning",
          offeredSlots: [morningSlot],
        },
      }),
    );

    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b10:00|\b10am/);
  });

  test("one inbound produces one authoritative scheduling response", async () => {
    const tomorrow = deployedTomorrow();
    consultationSlots = [deployedSlot(tomorrow, 14, 0), deployedSlot(tomorrow, 16, 0)];
    await runDeployed("Tomorrow afternoon", deployedSession());
    expect(capturedOutboundSms.length).toBe(1);
  });

  test("booking completes in the same turn through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const fourPm = deployedSlot(tomorrow, 16, 0);
    consultationSlots = [fourPm];

    const updated = await runDeployed(
      "4pm works",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "afternoon",
          offeredSlots: [fourPm],
        },
      }),
    );

    expect(updated?.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
  });

  test("successful booking sends at most one confirmation through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const fourPm = deployedSlot(tomorrow, 16, 0);
    consultationSlots = [fourPm];

    await runDeployed(
      "4pm works",
      deployedSession({
        scheduling: {
          status: "slots_offered",
          centralDate: tomorrow,
          partOfDay: "afternoon",
          offeredSlots: [fourPm],
        },
      }),
    );

    expect(capturedOutboundSms.length).toBeLessThanOrEqual(1);
    if (capturedOutboundSms[0]) {
      expect(capturedOutboundSms.filter((msg) => /\bbooked\b|\bconfirmed\b|\bsee you\b/i.test(msg)).length).toBeLessThanOrEqual(1);
    }
  });

  test("post-book acknowledgment does not restart scheduling through handleInbound", async () => {
    const tomorrow = deployedTomorrow();
    const fourPm = deployedSlot(tomorrow, 16, 0);

    const updated = await runDeployed(
      "Thanks",
      deployedSession({
        disposition: "booked",
        state: "completed",
        scheduling: {
          status: "confirmed",
          selectedStart: fourPm,
          calendarEventId: "evt-confirmed",
        },
      }),
      async () => ({
        output: [
          {
            type: "message" as const,
            role: "assistant" as const,
            content: [{ type: "output_text" as const, text: "Want to grab another time?" }],
          },
        ],
        outputText: "Want to grab another time?",
      }),
    );

    expect(updated?.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(0);
    expect(capturedOutboundSms.length).toBe(0);
  });

  test("orchestrator failure sends safe recovery without rules calendar link", async () => {
    consultationSlots = [deployedSlot(deployedTomorrow(), 14, 0)];
    await runDeployed("We miss calls all day", deployedSession(), async () => {
      throw new Error("model unavailable");
    });
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.includes("calendar.app.google")).toBe(false);
    expect(capturedOutboundSms[0]?.trim().length).toBeGreaterThan(0);
  });

  test("orchestrator handled:false recovery does not fall through to rules calendar link", async () => {
    const tomorrow = deployedTomorrow();
    consultationSlots = [deployedSlot(tomorrow, 14, 0), deployedSlot(tomorrow, 16, 0)];

    await runDeployed(
      "Tomorrow afternoon",
      deployedSession({
        scheduling: {
          status: "idle",
          centralDate: tomorrow,
          partOfDay: "afternoon",
        },
      }),
      async () => ({
        output: [
          {
            type: "message" as const,
            role: "assistant" as const,
            content: [
              {
                type: "output_text" as const,
                text: "Reply with exactly BOOK NOW to confirm https://calendar.app.google/test",
              },
            ],
          },
        ],
        outputText: "Reply with exactly BOOK NOW to confirm https://calendar.app.google/test",
      }),
    );

    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.includes("calendar.app.google")).toBe(false);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/reply with exactly/);
  });
});
