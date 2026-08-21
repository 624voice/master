import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
import { appendAssistantMessage, appendUserMessage } from "~/server/speed2Lead/memory";
import {
  computeNextNurtureAt,
  shouldSendNurtureFollowUp,
} from "~/server/speed2Lead/nurtureFollowUp";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingController";
import { rankSlotsForOffer } from "~/server/speed2Lead/slotRanking";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

let consultationSlots: string[] = [];
let availabilityMode: "ok" | "unconfigured" = "ok";
let bookingShouldFail = false;
let bookingCalls = 0;
let lastBookedStart: string | null = null;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    if (availabilityMode === "unconfigured") {
      return { ok: false, reason: "not_configured" };
    }
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
    if (bookingShouldFail) {
      return { ok: false, reason: "slot_unavailable" };
    }
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

function fridayDateString(): string {
  const parts = fridayParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function fridaySlot(hour: number, minute = 0): string {
  const parts = fridayParts(now);
  return centralDateAt(parts.year, parts.month, parts.day, hour, minute, TZ).toISOString();
}

function wednesdaySlot(hour: number, minute = 0): string {
  return centralDateAt(2026, 8, 26, hour, minute, TZ).toISOString();
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
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function silentModel(): ModelRunner {
  return async () => ({ output: [], outputText: "" });
}

function toxicModel(reply: string): ModelRunner {
  return async () => ({ output: [], outputText: reply });
}

async function runTurn(
  session: ConversationContext,
  message: string,
  runModel: ModelRunner = silentModel(),
): Promise<{ session: ConversationContext; reply: string; handled: boolean }> {
  const result = await orchestrateInboundTurn(session, message, { now, runModel });
  if (!result.handled) {
    return { session: result.context, reply: result.recoveryReply ?? "", handled: false };
  }
  const next = appendAssistantMessage(result.context, result.reply);
  return { session: next, reply: result.reply, handled: true };
}

function afternoonOnly(slots: string[]): boolean {
  return slots.every((slot) => {
    const parts = parseCentralParts(new Date(slot), TZ);
    return parts.hour >= 12 && parts.hour < 17;
  });
}

beforeEach(() => {
  consultationSlots = [];
  availabilityMode = "ok";
  bookingShouldFail = false;
  bookingCalls = 0;
  lastBookedStart = null;
});

describe("behavioral E2E A-P through orchestrateInboundTurn", () => {
  test("A vague prospect: diagnostic then schedules and books", async () => {
    const slot = fridaySlot(14, 0);
    consultationSlots = [slot, fridaySlot(15, 0)];

    let session = roiSession({
      messages: [{ role: "assistant", content: "What's the biggest leak?", at: now.toISOString() }],
    });

    let turn = await runTurn(
      session,
      "Not really sure",
      toxicModel("What happens when a lead comes in after hours?"),
    );
    expect(turn.handled).toBe(true);
    session = turn.session;

    turn = await runTurn(
      session,
      "We usually miss them til morning",
      toxicModel("Slow response costs jobs — worth a quick call to walk through it?"),
    );
    expect(turn.handled).toBe(true);
    session = turn.session;

    turn = await runTurn(session, "Yeah let's talk", silentModel());
    expect(turn.handled).toBe(true);
    expect(turn.reply.toLowerCase()).toMatch(/what day|morning|afternoon/);

    session = {
      ...turn.session,
      knownFacts: { ...turn.session.knownFacts!, fit: "yes", primaryPain: "missed calls" },
      scheduling: { status: "idle", centralDate: fridayDateString(), partOfDay: "afternoon" },
    };
    turn = await runTurn(session, "Friday afternoon", silentModel());
    expect(turn.handled).toBe(true);
    expect(turn.session.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);

    turn = await runTurn(turn.session, "3pm works", silentModel());
    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
  });

  test("B clear pain: minimal discovery then books", async () => {
    const slots = [wednesdaySlot(14, 0), wednesdaySlot(15, 0), wednesdaySlot(16, 0)];
    consultationSlots = slots;

    let session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        fit: "yes",
        questionsAsked: 0,
      },
      scheduling: { status: "idle", centralDate: "2026-08-26", partOfDay: "afternoon" },
    });

    const avail = await runTurn(session, "Wednesday afternoon works", silentModel());
    expect(avail.session.scheduling?.status).toBe("slots_offered");
    expect(avail.session.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);

    const book = await runTurn(avail.session, "3pm works", silentModel());
    expect(book.session.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
  });

  test("C direct meeting intent skips discovery and asks scheduling preference", async () => {
    const plan = planSchedulingGate({
      inboundMessage: "Can we schedule a call this week?",
      context: roiSession({ knownFacts: { ...roiSession().knownFacts!, fit: "yes" } }),
      now,
    });
    expect(plan.schedulingIntent).toBe(true);
    expect(plan.action.type).toBe("ask_preference");

    const turn = await runTurn(
      roiSession({ knownFacts: { ...roiSession().knownFacts!, fit: "yes" } }),
      "Can we schedule a call this week?",
      toxicModel("Tell me more about your business first."),
    );
    expect(turn.reply.toLowerCase()).toMatch(/what day|morning|afternoon/);
  });

  test("D day only asks morning or afternoon before slots", async () => {
    const plan = planSchedulingGate({
      inboundMessage: "How about Friday",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, fit: "yes" },
      }),
      now,
    });
    expect(["ask_preference", "get_availability"]).toContain(plan.action.type);

    const turn = await runTurn(
      roiSession({ knownFacts: { ...roiSession().knownFacts!, fit: "yes" } }),
      "How about Friday",
      silentModel(),
    );
    expect(turn.reply.toLowerCase()).toMatch(/morning or afternoon/);
    expect(turn.session.scheduling?.offeredSlots?.length ?? 0).toBe(0);
  });

  test("E afternoon returns only afternoon slots", async () => {
    consultationSlots = [
      wednesdaySlot(10, 0),
      wednesdaySlot(14, 0),
      wednesdaySlot(15, 0),
    ];

    const turn = await runTurn(
      roiSession({
        scheduling: { status: "idle", centralDate: "2026-08-26", partOfDay: "afternoon" },
        knownFacts: { ...roiSession().knownFacts!, fit: "yes" },
      }),
      "Afternoon",
      silentModel(),
    );

    const offered = turn.session.scheduling?.offeredSlots ?? [];
    expect(offered.length).toBeGreaterThan(0);
    expect(afternoonOnly(offered)).toBe(true);
  });

  test("F exact 3pm available books without neighboring options", async () => {
    const threePm = wednesdaySlot(15, 0);
    consultationSlots = [threePm];

    const turn = await runTurn(
      roiSession({
        scheduling: { status: "idle", centralDate: "2026-08-26", partOfDay: "afternoon" },
      }),
      "Wednesday at 3pm",
      silentModel(),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(lastBookedStart).toBe(threePm);
    expect(bookingCalls).toBe(1);
    expect(turn.reply.toLowerCase()).not.toMatch(/\bor\b.*\b3:/);
  });

  test("G exact 4pm unavailable offers alternatives then books selection", async () => {
    const threeThirty = fridaySlot(15, 30);
    const fourThirty = fridaySlot(16, 30);
    consultationSlots = [threeThirty, fourThirty];

    let session = roiSession({
      scheduling: { status: "idle", centralDate: fridayDateString(), partOfDay: "afternoon" },
    });

    let turn = await runTurn(session, "Friday at 4pm", silentModel());
    expect(turn.session.scheduling?.status).not.toBe("confirmed");
    expect(turn.session.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);

    turn = await runTurn(turn.session, "4:30 works", silentModel());
    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(lastBookedStart).toBe(fourThirty);
  });

  test("H rejected slots yields fresh set on new preference", async () => {
    const early = wednesdaySlot(14, 0);
    const mid = wednesdaySlot(15, 0);
    const late = wednesdaySlot(16, 0);
    consultationSlots = [early, mid, late];

    let session = roiSession({
      scheduling: {
        status: "slots_offered",
        offeredSlots: [early, mid],
        centralDate: "2026-08-26",
        partOfDay: "afternoon",
        rejectedSlotStarts: [early],
      },
    });

    const turn = await runTurn(session, "Need something later", silentModel());
    const offered = turn.session.scheduling?.offeredSlots ?? [];
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((s) => s !== early)).toBe(true);
  });

  test("I shorthand selection books correct offered slot", async () => {
    const target = wednesdaySlot(15, 0);
    consultationSlots = [target];

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: [target],
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      "3 is good",
      toxicModel('Reply exactly "Yes, book 3pm" to confirm.'),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(lastBookedStart).toBe(target);
    expect(turn.reply).not.toMatch(/reply with exactly/i);
  });

  test("J changed preference preserves Friday through later and around 4", async () => {
    const three = fridaySlot(15, 0);
    const four = fridaySlot(16, 0);
    consultationSlots = [three, four];

    let session = roiSession({
      scheduling: { status: "idle", centralDate: fridayDateString() },
    });

    let turn = await runTurn(session, "Friday afternoon", silentModel());
    expect(turn.session.scheduling?.centralDate).toBe(fridayDateString());

    session = {
      ...turn.session,
      scheduling: {
        ...turn.session.scheduling!,
        status: "slots_offered",
        offeredSlots: [three],
        partOfDay: "afternoon",
      },
    };

    turn = await runTurn(session, "Need something later", silentModel());
    expect(turn.session.scheduling?.centralDate).toBe(fridayDateString());

    session = {
      ...turn.session,
      scheduling: {
        ...turn.session.scheduling!,
        anchorTimeMinutes: 16 * 60,
      },
    };
    turn = await runTurn(session, "Around 4", silentModel());
    expect(turn.session.scheduling?.centralDate).toBe(fridayDateString());
    expect(turn.session.scheduling?.anchorTimeMinutes).toBe(16 * 60);
  });

  test("K booking conflict refreshes alternatives and books on retry", async () => {
    const taken = wednesdaySlot(15, 0);
    const alt = wednesdaySlot(16, 0);
    consultationSlots = [alt];

    bookingShouldFail = true;
    let turn = await runTurn(
      roiSession({
        scheduling: { status: "slots_offered", offeredSlots: [taken], centralDate: "2026-08-26" },
      }),
      "3pm works",
      silentModel(),
    );
    expect(turn.session.scheduling?.status).not.toBe("confirmed");
    expect(turn.reply.toLowerCase()).toMatch(/taken|instead|have/);

    bookingShouldFail = false;
    const offered = turn.session.scheduling?.offeredSlots ?? [alt];
    turn = await runTurn(turn.session, `${parseCentralParts(new Date(offered[0]!), TZ).hour} works`, silentModel());
    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(2);
  });

  test("L calendar failure allows calendar link fallback", async () => {
    availabilityMode = "unconfigured";

    const turn = await runTurn(
      roiSession({
        knownFacts: { ...roiSession().knownFacts!, fit: "yes" },
        scheduling: { status: "idle", centralDate: fridayDateString(), partOfDay: "afternoon" },
      }),
      "Friday afternoon",
      async () => ({
        output: [
          {
            type: "function_call" as const,
            call_id: "avail-fail",
            name: "get_availability",
            arguments: JSON.stringify({
              centralDate: fridayDateString(),
              partOfDay: "afternoon",
              maxSlots: 3,
            }),
          },
        ],
        outputText: "",
      }),
    );

    expect(turn.reply).toContain("calendar.app.google");
    expect(turn.session.scheduling?.calendarUnavailable).toBe(true);
  });

  test("M post-book acknowledgment does not restart scheduling", async () => {
    const booked = fridaySlot(16, 0);
    const turn = await runTurn(
      roiSession({
        disposition: "booked",
        scheduling: {
          status: "confirmed",
          selectedStart: booked,
          calendarEventId: "evt-done",
        },
      }),
      "Perfect thanks",
      toxicModel("Want to grab another time this week?"),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(0);
    expect(turn.session.scheduling?.calendarEventId).toBe("evt-done");
  });

  test("N resistance soft-closes without scheduling pressure", async () => {
    const plan = planSchedulingGate({
      inboundMessage: "I'm busy right now",
      context: roiSession(),
      now,
    });
    expect(plan.schedulingIntent).toBe(false);

    const turn = await runTurn(
      roiSession(),
      "I'm busy right now",
      toxicModel("No problem — what day works for a quick call?"),
    );
    expect(turn.session.scheduling?.status ?? "idle").toBe("idle");
    expect(bookingCalls).toBe(0);
    expect(turn.session.scheduling?.offeredSlots?.length ?? 0).toBe(0);
  });

  test("O nurture eligibility respects reply cancellation", () => {
    const session = roiSession({
      nurtureStage: 0,
      nurtureNextAt: new Date(now.getTime() - 1000).toISOString(),
      nurtureStartedAt: now.toISOString(),
      messages: [{ role: "user", content: "Hey", at: now.toISOString() }],
    });
    expect(shouldSendNurtureFollowUp(session, now)).toBe(false);
    expect(computeNextNurtureAt(roiSession({ nurtureStartedAt: now.toISOString() }), 2)).toBeTruthy();
  });

  test("P booking uses lifecycle confirmation without duplicate orchestrator SMS", async () => {
    const slot = fridaySlot(16, 0);
    consultationSlots = [slot];

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: [slot],
          centralDate: fridayDateString(),
          partOfDay: "afternoon",
        },
      }),
      "4pm works",
      silentModel(),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
    expect(turn.reply.trim()).toBe("");
  });
});

describe("handset failure class replays with varied wording", () => {
  test("bare-hour selection without follow-up prompt", async () => {
    const slots = [wednesdaySlot(14, 45), wednesdaySlot(15, 0), wednesdaySlot(15, 15)];
    consultationSlots = slots;

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: slots,
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      "3 is good",
      toxicModel("Got it — booking that now."),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(turn.reply).not.toMatch(/booking that now/i);
  });

  test("afternoon refinement does not re-offer rejected morning character", async () => {
    const morning = wednesdaySlot(10, 0);
    const afternoon = wednesdaySlot(15, 0);
    consultationSlots = [morning, afternoon];

    const ranked = rankSlotsForOffer(consultationSlots, {
      partOfDay: "afternoon",
      rejectedPartOfDay: ["morning"],
      maxOffer: 3,
    });
    expect(ranked.every((s) => s !== morning)).toBe(true);
  });

  test("healthy calendar never sends link while slots are offered", async () => {
    consultationSlots = [wednesdaySlot(14, 0), wednesdaySlot(15, 0), wednesdaySlot(16, 0)];

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "idle",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      "Afternoon works",
      toxicModel("Easiest is my calendar link: https://calendar.app.google/test"),
    );

    expect(turn.reply).not.toContain("calendar.app.google");
    expect(turn.session.scheduling?.status).toBe("slots_offered");
    expect(turn.session.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);
  });

  test("no availability question without resolved date", async () => {
    const plan = planSchedulingGate({
      inboundMessage: "What times do you have open?",
      context: roiSession({ knownFacts: { ...roiSession().knownFacts!, fit: "yes" } }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
  });
});

describe("deterministic stress: LLM variance cannot break orchestration", () => {
  test("LLM pending-work message is replaced by completed action", async () => {
    consultationSlots = [wednesdaySlot(15, 0)];

    const turn = await runTurn(
      roiSession({
        scheduling: { status: "slots_offered", offeredSlots: [wednesdaySlot(15, 0)] },
      }),
      "let's do 3",
      toxicModel("Let me check availability now."),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
    expect(turn.reply).not.toMatch(/let me check/i);
  });

  test("unauthorized LLM book on refinement request is blocked", async () => {
    consultationSlots = [
      wednesdaySlot(13, 0),
      wednesdaySlot(14, 0),
      wednesdaySlot(16, 30),
      wednesdaySlot(17, 0),
    ];

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: [wednesdaySlot(13, 0), wednesdaySlot(14, 0), wednesdaySlot(16, 0)],
        },
      }),
      "Anything around 4:30 instead?",
      async () => ({
        output: [
          {
            type: "function_call" as const,
            call_id: "bad-book",
            name: "book_appointment",
            arguments: JSON.stringify({ start: wednesdaySlot(13, 0) }),
          },
        ],
        outputText: "",
      }),
    );

    expect(turn.session.scheduling?.status).not.toBe("confirmed");
    expect(bookingCalls).toBe(0);
  });

  test("noisy typo selection still books when slot is unambiguous", async () => {
    const target = wednesdaySlot(15, 0);
    consultationSlots = [target];

    const turn = await runTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: [target],
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      "3pm s good",
      silentModel(),
    );

    expect(turn.session.scheduling?.status).toBe("confirmed");
  });
});
