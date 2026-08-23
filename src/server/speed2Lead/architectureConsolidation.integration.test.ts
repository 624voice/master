import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { containsUnsupportedProductClaim } from "~/server/speed2Lead/businessContext";
import {
  advanceDiscoveryOnInbound,
  isDiscoveryComplete,
  isReportReactionComplete,
  MAX_DIAGNOSTIC_QUESTIONS,
  normalizeDiscoveryFacts,
  recordDiscoveryAssistantTurn,
} from "~/server/speed2Lead/discoveryProgress";
import { resolveLlmTurnTask } from "~/server/speed2Lead/conversationStage";
import { detectExplicitSchedulingRequest } from "~/server/speed2Lead/conversationHandoff";
import { genericRecoveryMessage } from "~/server/speed2Lead/guardrails";
import { appendUserMessage } from "~/server/speed2Lead/memory";
import { orchestrateInboundTurn, type ModelRunner } from "~/server/speed2Lead/orchestrator";
import {
  executeOrchestratorTool,
  createInitialToolState,
} from "~/server/speed2Lead/tools";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import type { ConversationContext } from "~/server/speed2Lead/types";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const phone = "+15559876543";

let consultationSlots: string[] = [];
let bookingResult: { ok: boolean; reason?: string } = { ok: true };
let availabilityMode: "ok" | "api_error" = "ok";

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    if (availabilityMode === "api_error") {
      return { ok: false, reason: "calendar_api_error", detail: "403" };
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
  calendarAttendeeInviteEnabled: () => false,
}));

mock.module("~/server/appointmentLifecycle/bookConsultation", () => ({
  bookConsultation: async () => ({
    ok: bookingResult.ok,
    reason: bookingResult.reason,
    eventId: "evt-1",
    selectedStart: consultationSlots[0] ?? "",
    replayed: false,
    lifecycle: { action: "created", smsSent: true },
  }),
}));

mock.module("~/server/appointmentLifecycle/handleInbound", () => ({
  handleAppointmentLifecycleInbound: async () => ({ handled: false, sessionPersisted: false }),
}));

mock.module("~/server/speed2Lead/transcript", () => ({
  logSmsTranscriptSafely: () => {},
}));

function mondayDate(): string {
  return "2026-08-24";
}

function tuesdayDate(): string {
  return "2026-08-25";
}

function slot(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
}

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone,
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
      phone,
      flow: "roi",
      businessName: "Test Plumbing",
      questionsAsked: 0,
      discoveryPhase: "awaiting_report_reaction",
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function emptyModel(): ModelRunner {
  return async () => ({ output: [], outputText: "" });
}

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
  consultationSlots = [];
  bookingResult = { ok: true };
  availabilityMode = "ok";
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = phone;
  process.env.OPENAI_API_KEY = "test-key";
});

describe("architecture consolidation — discovery", () => {
  test("1: report reaction + pain → diagnostic then bridge path", () => {
    let session = roiSession({
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "Missed calls hurt us", at: now.toISOString() },
      ],
    });
    session = advanceDiscoveryOnInbound(session, "Missed calls hurt us");
    expect(session.knownFacts.primaryPain).toMatch(/missed calls/i);
    const plan = resolveLlmTurnTask(session, "Missed calls hurt us");
    expect(["ask_one_operational_followup", "ask_conditional_meeting_bridge"]).toContain(plan.task);
  });

  test("2: unclear response allows second diagnostic before bridge", () => {
    let session = roiSession({
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "not sure", at: now.toISOString() },
        { role: "assistant", content: "What happens when a lead comes in?", at: now.toISOString() },
      ],
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: 1,
        discoveryPhase: "diagnostic",
      },
    });
    session = advanceDiscoveryOnInbound(session, "hard to say");
    expect(isDiscoveryComplete(session)).toBe(false);
    expect(resolveLlmTurnTask(session, "hard to say").task).toBe("ask_one_operational_followup");
  });

  test("3: never more than two diagnostic questions", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: MAX_DIAGNOSTIC_QUESTIONS,
        primaryPain: "missed calls",
        discoveryPhase: "discovery_complete",
      },
    });
    expect(resolveLlmTurnTask(session, "still thinking").task).toBe("ask_conditional_meeting_bridge");
  });

  test("4: opening question does not count toward discovery cap", () => {
    const session = recordDiscoveryAssistantTurn(
      roiSession({
        messages: [{ role: "assistant", content: "Which part stood out most?", at: now.toISOString() }],
      }),
      "acknowledge_report_reaction_and_ask_one_operational_question",
      "Which part stood out most?",
    );
    expect(session.knownFacts.diagnosticQuestionsAsked ?? 0).toBe(0);
  });

  test("5: progression works without LLM update_known_facts", () => {
    let session = roiSession({
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "Missed calls", at: now.toISOString() },
      ],
    });
    session = advanceDiscoveryOnInbound(session, "Missed calls");
    expect(session.knownFacts.primaryPain).toBeTruthy();
    expect(isReportReactionComplete(session)).toBe(true);
  });

  test("6: explicit book meeting skips discovery", () => {
    let session = roiSession({
      messages: [{ role: "assistant", content: "Which part stood out most?", at: now.toISOString() }],
    });
    session = advanceDiscoveryOnInbound(session, "Let's book a meeting Tuesday");
    expect(detectExplicitSchedulingRequest("Let's book a meeting Tuesday")).toBe(true);
    expect(session.knownFacts.discoveryPhase).toBe("scheduling");
  });
});

describe("architecture consolidation — business knowledge", () => {
  test("7: unsupported missed-call tracking claims are detectable", () => {
    expect(containsUnsupportedProductClaim("We track missed calls for you")).toBe(true);
    expect(containsUnsupportedProductClaim("flag missed calls for follow-up")).toBe(true);
  });

  test("8: positioning connects missed calls to response action", () => {
    expect(containsUnsupportedProductClaim("We answer missed calls quickly and follow up")).toBe(false);
  });

  test("9: dashboard/reporting claims are unsupported", () => {
    expect(containsUnsupportedProductClaim("missed call reporting dashboard")).toBe(true);
  });
});

describe("architecture consolidation — stage recovery", () => {
  test("10: recovery after discovery never repeats report question", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: 1,
        primaryPain: "missed calls",
        discoveryPhase: "discovery_complete",
      },
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "missed calls", at: now.toISOString() },
      ],
    });
    expect(genericRecoveryMessage(session).toLowerCase()).not.toMatch(/which part stood out/);
  });

  test("11: discovery phase is monotonic", () => {
    const first = normalizeDiscoveryFacts({
      ...roiSession().knownFacts!,
      discoveryPhase: "discovery_complete",
    });
    const second = normalizeDiscoveryFacts({
      ...first,
      discoveryPhase: "diagnostic",
    });
    expect(second.discoveryPhase).toBe("discovery_complete");
  });
});

describe("architecture consolidation — scheduling truth", () => {
  test("12: Monday morning offers only returned slots", async () => {
    consultationSlots = [slot(mondayDate(), 9, 0), slot(mondayDate(), 9, 45)];
    const result = await orchestrateInboundTurn(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          meetingBridgeComplete: true,
          primaryPain: "missed calls",
          diagnosticQuestionsAsked: 1,
          discoveryPhase: "scheduling",
        },
        messages: [
          { role: "assistant", content: "Worth a quick 25-minute look?", at: now.toISOString() },
          { role: "user", content: "Sure", at: now.toISOString() },
        ],
      }),
      "Monday morning",
      { now, runModel: emptyModel() },
    );
    expect(result.reply.toLowerCase()).toMatch(/9:00|9:45/);
    expect(result.reply.toLowerCase()).not.toMatch(/just got taken/);
  });

  test("13: Tuesday change refreshes without Monday slots", async () => {
    consultationSlots = [slot(mondayDate(), 9, 0)];
    let session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        diagnosticQuestionsAsked: 1,
        discoveryPhase: "scheduling",
      },
      scheduling: {
        status: "slots_offered",
        centralDate: mondayDate(),
        partOfDay: "morning",
        offeredSlots: [slot(mondayDate(), 9, 0)],
        activeRequestKey: `date:${mondayDate()}|morning`,
      },
    });
    consultationSlots = [slot(tuesdayDate(), 9, 0), slot(tuesdayDate(), 10, 0)];
    const result = await orchestrateInboundTurn(session, "What about Tuesday?", {
      now,
      runModel: emptyModel(),
    });
    expect(result.context.scheduling?.centralDate).toBe(tuesdayDate());
    expect(result.reply).not.toContain("9:00");
    expect(result.reply.toLowerCase()).toMatch(/9(:00)?am|10(:00)?am|9:00|10:00/);
  });

  test("14-15: exact 4pm request fetches and books when available", async () => {
    consultationSlots = [
      slot(mondayDate(), 12, 15),
      slot(mondayDate(), 13, 0),
      slot(mondayDate(), 13, 45),
      slot(mondayDate(), 16, 0),
    ];
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        diagnosticQuestionsAsked: 1,
        discoveryPhase: "scheduling",
      },
      scheduling: {
        status: "slots_offered",
        centralDate: mondayDate(),
        partOfDay: "afternoon",
        offeredSlots: consultationSlots.slice(0, 3),
        activeRequestKey: `date:${mondayDate()}|afternoon`,
      },
    });
    const result = await orchestrateInboundTurn(session, "Let's do 4 if you have it", {
      now,
      runModel: emptyModel(),
    });
    expect(result.reply.toLowerCase()).not.toMatch(/just got taken/);
    expect(result.context.scheduling?.status === "confirmed" || result.reply.toLowerCase().includes("book")).toBe(
      true,
    );
  });

  test("16: exact 4pm unavailable returns truthful unavailable copy", async () => {
    consultationSlots = [slot(mondayDate(), 12, 15), slot(mondayDate(), 13, 0)];
    const result = await orchestrateInboundTurn(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          meetingBridgeComplete: true,
          diagnosticQuestionsAsked: 1,
          discoveryPhase: "scheduling",
        },
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          offeredSlots: consultationSlots,
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
      "How about 4 if you have it?",
      { now, runModel: emptyModel() },
    );
    expect(result.reply.toLowerCase()).toMatch(/isn't open|not open|exact time/);
    expect(result.reply.toLowerCase()).not.toMatch(/just got taken/);
  });

  test("17: slot_not_offered never produces just got taken", async () => {
    const offered = [slot(mondayDate(), 13, 0)];
    const executed = await executeOrchestratorTool(
      "book_appointment",
      { start: slot(mondayDate(), 16, 0), notes: null },
      roiSession({
        scheduling: { status: "slots_offered", offeredSlots: offered },
      }),
      { ...createInitialToolState(), offeredSlots: offered },
      now,
    );
    expect((executed.result as { reason?: string }).reason).toBe("slot_not_offered");
    expect(executed.state.bookingFailed).toBe(false);
    expect(executed.state.lastBookingFailureReason).toBe("invalid_selection");
  });

  test("18: provider conflict may use conflict language", async () => {
    bookingResult = { ok: false, reason: "slot_unavailable" };
    consultationSlots = [slot(mondayDate(), 13, 0)];
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        diagnosticQuestionsAsked: 1,
        discoveryPhase: "scheduling",
      },
      scheduling: {
        status: "slots_offered",
        centralDate: mondayDate(),
        partOfDay: "afternoon",
        offeredSlots: consultationSlots,
        activeRequestKey: `date:${mondayDate()}|afternoon`,
      },
    });
    bookingResult = { ok: false, reason: "slot_unavailable" };
    const result = await orchestrateInboundTurn(session, "1pm works", { now, runModel: emptyModel() });
    expect(result.reply.toLowerCase()).toMatch(/just got taken|filled up/);
  });

  test("19: clear offered-slot selection books without reconfirmation", async () => {
    consultationSlots = [slot(mondayDate(), 13, 0), slot(mondayDate(), 14, 0)];
    const result = await orchestrateInboundTurn(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          meetingBridgeComplete: true,
          diagnosticQuestionsAsked: 1,
          discoveryPhase: "scheduling",
        },
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          offeredSlots: consultationSlots,
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
      "1pm",
      { now, runModel: emptyModel() },
    );
    expect(result.reply.toLowerCase()).not.toMatch(/want me to grab|should i book/);
  });

  test("20: pricing during scheduling preserves state and avoids invented slots", async () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        diagnosticQuestionsAsked: 1,
        discoveryPhase: "scheduling",
      },
      scheduling: {
        status: "idle",
        centralDate: mondayDate(),
        partOfDay: "afternoon",
      },
    });
    const result = await orchestrateInboundTurn(session, "How does pricing work?", {
      now,
      runModel: async () => ({
        output: [],
        outputText: "Pricing depends on scope — happy to walk through it on a quick call.",
      }),
    });
    expect(result.context.scheduling?.centralDate).toBe(mondayDate());
    expect(result.context.scheduling?.partOfDay).toBe("afternoon");
    expect(result.reply.toLowerCase()).toMatch(/pricing|scope/);
  });

  test("21: provider failure does not invent async future work", async () => {
    availabilityMode = "api_error";
    const result = await orchestrateInboundTurn(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          meetingBridgeComplete: true,
          diagnosticQuestionsAsked: 1,
          discoveryPhase: "scheduling",
        },
        scheduling: { status: "idle", centralDate: mondayDate(), partOfDay: "morning" },
      }),
      "Monday morning",
      { now, runModel: emptyModel() },
    );
    expect(result.reply.toLowerCase()).not.toMatch(/check back|follow up later|working on it/);
  });

  test("22: confirmed booking cannot restart scheduling", async () => {
    const session = roiSession({
      disposition: "booked",
      scheduling: {
        status: "confirmed",
        selectedStart: slot(mondayDate(), 13, 0),
        calendarEventId: "evt-1",
      },
    });
    expect(resolveLlmTurnTask(session, "Monday afternoon").stage).toBe("booked");
  });
});
