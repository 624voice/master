import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  containsAiAsPrimaryBenefit,
  containsUnsupportedProductClaim,
  outcomeBridgeOutcomes,
} from "~/server/speed2Lead/businessContext";
import {
  advanceDiscoveryOnInbound,
  isDiscoveryComplete,
  isReportReactionComplete,
  MAX_DIAGNOSTIC_QUESTIONS,
  recordDiscoveryAssistantTurn,
} from "~/server/speed2Lead/discoveryProgress";
import { resolveLlmTurnTask } from "~/server/speed2Lead/conversationStage";
import { detectExplicitSchedulingRequest } from "~/server/speed2Lead/conversationHandoff";
import { isMeetingInterestConfirmed } from "~/server/speed2Lead/meetingInterest";
import { genericRecoveryMessage, validateOutboundSms } from "~/server/speed2Lead/guardrails";
import { appendUserMessage, seedKnownFacts, appendAssistantMessage } from "~/server/speed2Lead/memory";
import { orchestrateInboundTurn, type ModelRunner } from "~/server/speed2Lead/orchestrator";
import {
  executeOrchestratorTool,
  createInitialToolState,
} from "~/server/speed2Lead/tools";
import {
  inferTurnSemanticsDeterministic,
  isNonAnswerLike,
} from "~/server/speed2Lead/turnSemantics";
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
let bookConsultationCalls = 0;
let lastBookedEventId: string | undefined;

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
  bookConsultation: async (input: { start: string }) => {
    bookConsultationCalls += 1;
    if (!bookingResult.ok) {
      return { ok: false, reason: bookingResult.reason ?? "slot_unavailable" };
    }
    lastBookedEventId = "evt-google-1";
    return {
      ok: true,
      eventId: lastBookedEventId,
      selectedStart: input.start,
      googleMeetUrl: "https://meet.google.com/test-abc-defg-hij",
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

function mondayDate(): string {
  return "2026-08-24";
}

function tuesdayDate(): string {
  return "2026-08-25";
}

function tomorrowDate(): string {
  return "2026-08-22";
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
    trade: "plumbing",
    truckCount: 3,
    monthlyCalls: 120,
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone,
      flow: "roi",
      businessName: "Test Plumbing",
      trade: "plumbing",
      truckCount: 3,
      monthlyCalls: 120,
      annualOpportunity: "$120,000",
      customerGoal: "Missed calls",
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

function schedulingReady() {
  return {
    meetingInterestConfirmed: true,
    meetingBridgeComplete: true,
    primaryPain: "missed calls",
    diagnosticQuestionsAsked: 1,
    discoveryPhase: "scheduling" as const,
  };
}

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
  consultationSlots = [];
  bookingResult = { ok: true };
  availabilityMode = "ok";
  bookConsultationCalls = 0;
  lastBookedEventId = undefined;
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = phone;
  process.env.OPENAI_API_KEY = "test-key";
});

describe("conversion architecture", () => {
  test("1-3: discovery progression caps at bridge after two diagnostics", () => {
    let session = roiSession({
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "Missed calls hurt us", at: now.toISOString() },
      ],
    });
    session = advanceDiscoveryOnInbound(session, "Missed calls hurt us");
    expect(resolveLlmTurnTask(session, "Missed calls hurt us").task).toBe("ask_one_operational_followup");

    session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: MAX_DIAGNOSTIC_QUESTIONS,
        primaryPain: "missed calls",
        discoveryPhase: "discovery_complete",
      },
    });
    expect(resolveLlmTurnTask(session, "ok").task).toBe("ask_conditional_meeting_bridge");
  });

  test("4-7: non-answers and greetings do not falsely advance discovery", () => {
    const rich = advanceDiscoveryOnInbound(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          diagnosticQuestionsAsked: 1,
          discoveryPhase: "diagnostic",
        },
        messages: [
          { role: "assistant", content: "How are missed calls handled today?", at: now.toISOString() },
          { role: "user", content: "We miss tons of calls after hours and lose jobs", at: now.toISOString() },
        ],
      }),
      "We miss tons of calls after hours and lose jobs",
    );
    expect(isDiscoveryComplete(rich)).toBe(true);

    const opening = recordDiscoveryAssistantTurn(
      roiSession({
        messages: [{ role: "assistant", content: "Which part stood out most?", at: now.toISOString() }],
      }),
      "acknowledge_report_reaction_and_ask_one_operational_question",
      "Which part stood out most?",
    );
    expect(opening.knownFacts.diagnosticQuestionsAsked ?? 0).toBe(0);

    const diagSession = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: 1,
        primaryPain: "missed calls",
        discoveryPhase: "diagnostic",
      },
    });
    const greetingSemantics = inferTurnSemanticsDeterministic("hey man", diagSession);
    expect(isNonAnswerLike(greetingSemantics)).toBe(true);
    const afterGreeting = advanceDiscoveryOnInbound(diagSession, "hey man", greetingSemantics);
    expect(afterGreeting.knownFacts.diagnosticQuestionsAsked).toBe(1);

    const confused = advanceDiscoveryOnInbound(
      roiSession({ messages: [{ role: "assistant", content: "Which part stood out most?", at: now.toISOString() }] }),
      "huh?",
      inferTurnSemanticsDeterministic("huh?", roiSession()),
    );
    expect(confused.knownFacts.discoveryPhase).toBe("awaiting_report_reaction");
  });

  test("8-11: meeting interest and recovery monotonicity", async () => {
    const bridge = await orchestrateInboundTurn(
      roiSession({
        knownFacts: {
          ...roiSession().knownFacts!,
          diagnosticQuestionsAsked: 1,
          primaryPain: "missed calls",
          discoveryPhase: "bridge",
        },
        messages: [
          {
            role: "assistant",
            content: "Would it be worth 25 minutes to see how that could work?",
            at: now.toISOString(),
          },
        ],
      }),
      "Yes",
      { now, runModel: emptyModel() },
    );
    expect(isMeetingInterestConfirmed(bridge.context.knownFacts)).toBe(true);

    const afterInterest = roiSession({ knownFacts: schedulingReady() });
    expect(resolveLlmTurnTask(afterInterest, "yeah").stage).toBe("scheduling");

    const skipDiscovery = advanceDiscoveryOnInbound(roiSession(), "Let's book a meeting Tuesday");
    expect(skipDiscovery.knownFacts.discoveryPhase).toBe("scheduling");
    expect(detectExplicitSchedulingRequest("Let's book a meeting Tuesday")).toBe(true);

    const recovery = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        diagnosticQuestionsAsked: 1,
        primaryPain: "missed calls",
        discoveryPhase: "discovery_complete",
      },
    });
    expect(genericRecoveryMessage(recovery).toLowerCase()).not.toMatch(/which part stood out/);
  });

  test("12-16: lead facts and product positioning", () => {
    const facts = seedKnownFacts(roiSession());
    expect(facts.monthlyCalls).toBe(120);
    expect(facts.trade).toBe("plumbing");
    expect(facts.truckCount).toBe(3);
    expect(facts.customerGoal).toBe("Missed calls");
    expect(containsUnsupportedProductClaim("missed call reporting dashboard")).toBe(true);
    expect(outcomeBridgeOutcomes("missed calls").join(" ")).toMatch(/respond faster|book more/i);
    expect(containsAiAsPrimaryBenefit("worth a look at how AI could help")).toBe(true);
  });

  test("17-22: scheduling truth and Google booking execution", async () => {
    consultationSlots = [slot(mondayDate(), 9, 0), slot(mondayDate(), 9, 45)];
    const monday = await orchestrateInboundTurn(
      roiSession({ knownFacts: schedulingReady() }),
      "Monday morning",
      { now, runModel: emptyModel() },
    );
    expect(monday.reply.toLowerCase()).toMatch(/9:00|9:45/);

    consultationSlots = [slot(mondayDate(), 9, 0)];
    let session = roiSession({
      knownFacts: schedulingReady(),
      scheduling: {
        status: "slots_offered",
        centralDate: mondayDate(),
        partOfDay: "morning",
        offeredSlots: [slot(mondayDate(), 9, 0)],
        activeRequestKey: `date:${mondayDate()}|morning`,
      },
    });
    consultationSlots = [slot(tuesdayDate(), 9, 0), slot(tuesdayDate(), 10, 0)];
    const tuesday = await orchestrateInboundTurn(session, "What about Tuesday?", {
      now,
      runModel: emptyModel(),
    });
    expect(tuesday.context.scheduling?.centralDate).toBe(tuesdayDate());

    consultationSlots = [slot(mondayDate(), 15, 0), slot(mondayDate(), 13, 0)];
    bookConsultationCalls = 0;
    const book = await orchestrateInboundTurn(
      roiSession({
        knownFacts: schedulingReady(),
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          offeredSlots: [slot(mondayDate(), 13, 0)],
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
      "3pm",
      { now, runModel: emptyModel() },
    );
    expect(bookConsultationCalls).toBe(1);
    expect(book.context.scheduling?.calendarEventId).toBe("evt-google-1");
    expect(book.context.scheduling?.status).toBe("confirmed");
  });

  test("23-30: booking intent, conflict typing, FAQ preservation, post-book lock", async () => {
    consultationSlots = [slot(mondayDate(), 13, 0), slot(mondayDate(), 14, 0)];
    const selection = await orchestrateInboundTurn(
      roiSession({
        knownFacts: schedulingReady(),
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
    expect(selection.reply.toLowerCase()).not.toMatch(/want me to grab|should i book/);

    consultationSlots = [slot(mondayDate(), 13, 0)];
    bookConsultationCalls = 0;
    const bareYes = await orchestrateInboundTurn(
      roiSession({
        knownFacts: schedulingReady(),
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          offeredSlots: consultationSlots,
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
      "Yes",
      { now, runModel: emptyModel() },
    );
    expect(bookConsultationCalls).toBe(1);

    const offered = [slot(mondayDate(), 13, 0)];
    const invalid = await executeOrchestratorTool(
      "book_appointment",
      { start: slot(mondayDate(), 16, 0), notes: null },
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: offered } }),
      { ...createInitialToolState(), offeredSlots: offered },
      now,
    );
    expect((invalid.result as { reason?: string }).reason).toBe("slot_not_offered");
    expect(invalid.state.bookingFailed).toBe(false);

    bookingResult = { ok: false, reason: "slot_unavailable" };
    const conflict = await orchestrateInboundTurn(
      roiSession({
        knownFacts: schedulingReady(),
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          offeredSlots: offered,
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
      "1pm",
      { now, runModel: emptyModel() },
    );
    expect(conflict.reply.toLowerCase()).toMatch(/just got taken|filled up/);

    bookingResult = { ok: true };
    const faq = await orchestrateInboundTurn(
      roiSession({
        knownFacts: schedulingReady(),
        scheduling: { status: "idle", centralDate: mondayDate(), partOfDay: "afternoon" },
      }),
      "How does pricing work?",
      {
        now,
        runModel: async () => ({
          output: [],
          outputText: "Pricing depends on scope — happy to walk through it on a quick call.",
        }),
      },
    );
    expect(faq.context.scheduling?.centralDate).toBe(mondayDate());

    const start = slot(mondayDate(), 13, 0);
    const pass = validateOutboundSms("You're booked — see you then.", {
      session: roiSession({
        scheduling: { status: "confirmed", selectedStart: start, calendarEventId: "evt-1" },
      }),
      toolState: {
        ...createInitialToolState(),
        bookingConfirmed: true,
        bookingStart: start,
        bookingEventId: "evt-1",
      },
    });
    expect(pass.ok).toBe(true);

    const booked = roiSession({
      disposition: "booked",
      scheduling: {
        status: "confirmed",
        selectedStart: start,
        calendarEventId: "evt-1",
      },
    });
    expect(resolveLlmTurnTask(booked, "Monday afternoon").stage).toBe("booked");
  });

  test("31: end-to-end ROI path through Google booking", async () => {
    consultationSlots = [
      slot(tomorrowDate(), 12, 0),
      slot(tomorrowDate(), 13, 0),
      slot(tomorrowDate(), 15, 0),
    ];

    let session = roiSession({
      messages: [{ role: "assistant", content: "Which part stood out most?", at: now.toISOString() }],
    });
    session = appendUserMessage(session, "Missed calls are killing us");
    session = advanceDiscoveryOnInbound(session, "Missed calls are killing us");
    expect(isReportReactionComplete(session)).toBe(true);

    session = recordDiscoveryAssistantTurn(
      session,
      "ask_one_operational_followup",
      "How are you handling missed calls today?",
    );
    session = appendUserMessage(session, "We just call them back when we can");
    session = advanceDiscoveryOnInbound(session, "We just call them back when we can");

    session = recordDiscoveryAssistantTurn(
      session,
      "ask_conditional_meeting_bridge",
      "If I could show you a way to respond faster and book more jobs without adding headcount, would it be worth 25 minutes?",
    );
    session = appendAssistantMessage(
      session,
      "If I could show you a way to respond faster and book more jobs without adding headcount, would it be worth 25 minutes?",
    );

    const bridgeTurn = await orchestrateInboundTurn(session, "Yes", { now, runModel: emptyModel() });
    session = bridgeTurn.context;
    expect(isMeetingInterestConfirmed(session.knownFacts)).toBe(true);

    consultationSlots = [
      slot(mondayDate(), 12, 0),
      slot(mondayDate(), 13, 0),
      slot(mondayDate(), 15, 0),
    ];

    const dayTurn = await orchestrateInboundTurn(session, "Monday afternoon", {
      now,
      runModel: emptyModel(),
    });
    session = dayTurn.context;
    expect(session.scheduling?.centralDate).toBe(mondayDate());

    bookConsultationCalls = 0;
    const bookTurn = await orchestrateInboundTurn(session, "3pm", { now, runModel: emptyModel() });
    expect(bookConsultationCalls).toBe(1);
    expect(bookTurn.context.scheduling?.calendarEventId).toBe("evt-google-1");
    expect(bookTurn.context.scheduling?.status).toBe("confirmed");
  });
});
