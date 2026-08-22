import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { buildOrchestratorInstructions } from "~/server/speed2Lead/prompts";
import {
  containsDisallowedBotTerminology,
  countGenuineQuestions,
  violatesBridgeSchedulingSeparation,
} from "~/server/speed2Lead/outboundPolicy";
import {
  buildProviderUnavailableRecoveryMessage,
  calendarLinkFallbackMessage,
  validateOutboundSms,
} from "~/server/speed2Lead/guardrails";
import {
  resolveLlmTurnTask,
  shouldSendDeterministicSchedulingAsk,
} from "~/server/speed2Lead/conversationStage";
import { orchestrateInboundTurn } from "~/server/speed2Lead/orchestrator";
import { createInitialToolState } from "~/server/speed2Lead/tools";
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
let calendarApiFails = false;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    if (calendarApiFails) {
      return { ok: false, reason: "calendar_api_error" as const, detail: "simulated" };
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
  bookConsultation: async (input: { start: string }) => ({
    ok: true,
    eventId: "evt-1",
    selectedStart: input.start,
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

const { handleInboundSms } = await import("~/server/speed2Lead/handleInbound");
const handleInboundSource = await Bun.file(
  new URL("./handleInbound.ts", import.meta.url).pathname,
).text();

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
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function emptyModel() {
  return async () => ({ output: [], outputText: "" });
}

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
  calendarApiFails = false;
  consultationSlots = [];
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = phone;
  process.env.OPENAI_API_KEY = "test-key";
});

describe("architecture cleanup invariants", () => {
  test("1-2: LLM path does not fall back to rules-engine advanceConversation", () => {
    expect(handleInboundSource).toContain("// Non-LLM path only: legacy rules-engine conversation ownership.");
    expect(handleInboundSource).not.toContain("rules_after_llm_fallback");
    expect(handleInboundSource).not.toContain("orchestrated.recoveryReply");
  });

  test("3: LLM outbound with two questions fails validation", () => {
    const session = roiSession();
    const result = validateOutboundSms(
      "What day works? Morning or afternoon?",
      { session, toolState: createInitialToolState(), calendarLinkAllowed: false, allowProspectName: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("more than one question");
    }
  });

  test("4: bridge and scheduling ask in same outbound fails validation", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "manual follow-up",
        questionsAsked: 1,
      },
    });
    const stagePlan = resolveLlmTurnTask(session, "");
    expect(
      violatesBridgeSchedulingSeparation({
        text: "Worth a quick 25-minute look? What day works?",
        stage: stagePlan.stage,
        task: stagePlan.task,
      }),
    ).toBe(true);
  });

  test("5: Sure after bridge triggers deterministic scheduling ask", async () => {
    const session = roiSession({
      messages: [
        { role: "assistant", content: "Worth a quick look?", at: now.toISOString() },
        { role: "user", content: "Sure", at: now.toISOString() },
      ],
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "manual follow-up",
        questionsAsked: 1,
      },
    });
    const result = await orchestrateInboundTurn(session, "Sure", { now, runModel: emptyModel() });
    expect(result.handled).toBe(true);
    expect(result.reply.toLowerCase()).toMatch(/what day works/);
    expect(countGenuineQuestions(result.reply)).toBeLessThanOrEqual(1);
    expect(result.reply.toLowerCase()).not.toMatch(/morning or afternoon.*what day/);
  });

  test("6-7: provider failure preserves known date/daypart without asking customer to repeat", async () => {
    calendarApiFails = true;
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        questionsAsked: 1,
        primaryPain: "manual follow-up",
      },
      messages: [
        { role: "assistant", content: "What day works?", at: now.toISOString() },
      ],
    });
    const result = await orchestrateInboundTurn(session, "Wednesday afternoon", {
      now,
      runModel: emptyModel(),
    });
    expect(result.reply.toLowerCase()).not.toMatch(/mind sending that again|hit a snag/);
    expect(result.reply.toLowerCase()).toMatch(/calendar|timing noted|slow/);
    expect(result.context.scheduling?.centralDate).toBeTruthy();
    expect(result.context.scheduling?.partOfDay).toBe("afternoon");
  });

  test("8: LLM cannot pass validation with unauthorized calendar URL", () => {
    const session = roiSession();
    const result = validateOutboundSms(
      "Here you go: https://calendar.app.google/test",
      { session, toolState: createInitialToolState(), calendarLinkAllowed: false },
    );
    expect(result.ok).toBe(false);
  });

  test("9: deterministic code owns authorized calendar link", () => {
    const session = roiSession();
    const link = calendarLinkFallbackMessage(session);
    expect(link).toContain("https://calendar.app.google/test");
    const blocked = validateOutboundSms(link, {
      session,
      toolState: createInitialToolState(),
      calendarLinkAllowed: false,
    });
    expect(blocked.ok).toBe(false);
    const allowed = validateOutboundSms(link, {
      session,
      toolState: createInitialToolState(),
      calendarLinkAllowed: true,
    });
    expect(allowed.ok).toBe(true);
  });

  test("10: bot terminology fails validation", () => {
    expect(containsDisallowedBotTerminology("AI bots can help with follow-up")).toBe(true);
    const session = roiSession();
    const result = validateOutboundSms("AI bots can help with follow-up.", {
      session,
      toolState: createInitialToolState(),
    });
    expect(result.ok).toBe(false);
  });

  test("11: prospect name blocked outside booking confirmation", () => {
    const session = roiSession();
    const result = validateOutboundSms("Got it, Alex — what stood out most?", {
      session,
      toolState: createInitialToolState(),
      allowProspectName: false,
    });
    expect(result.ok).toBe(false);
  });

  test("12-13: simplified prompt excludes scheduling state and bookingUrl", () => {
    const prompt = buildOrchestratorInstructions(roiSession(), now, "Just manually");
    expect(prompt).not.toContain("bookingUrl");
    expect(prompt).not.toContain("schedulingState");
    expect(prompt).not.toContain("recentMessages");
    expect(prompt).toContain('"task"');
  });

  test("14: soft-close generic ack unchanged", async () => {
    const session = roiSession({ disposition: "soft_closed" });
    const result = await orchestrateInboundTurn(session, "Ok", { now, runModel: emptyModel() });
    expect(result.reply).toBe("Sounds good.");
  });

  test("provider recovery offers link only when authorized", () => {
    const session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: "2026-08-26",
        partOfDay: "afternoon",
        calendarUnavailable: true,
        providerFailureReason: "calendar_api_error",
      },
    });
    const first = buildProviderUnavailableRecoveryMessage(session, false);
    expect(first).not.toContain("grab a time here");
    expect(first.toLowerCase()).not.toMatch(/shortly|within a couple|will send|checking available/);
    const second = buildProviderUnavailableRecoveryMessage(session, true);
    expect(second).toContain("grab a time here");
  });

  test("shouldSendDeterministicSchedulingAsk only after bridge delivered and agreement", () => {
    const bridged = roiSession({
      messages: [
        {
          role: "assistant",
          content: "Worth a quick 25-minute look at how AI could help with that?",
          at: now.toISOString(),
        },
      ],
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        primaryPain: "manual",
        questionsAsked: 1,
      },
    });
    expect(shouldSendDeterministicSchedulingAsk(bridged, "Sure")).toBe(true);
    expect(shouldSendDeterministicSchedulingAsk(bridged, "Not sure")).toBe(false);
    expect(shouldSendDeterministicSchedulingAsk(bridged, "Wednesday afternoon")).toBe(false);

    const bridgeNotDelivered = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingBridgeComplete: true,
        primaryPain: "manual",
        questionsAsked: 1,
      },
    });
    expect(shouldSendDeterministicSchedulingAsk(bridgeNotDelivered, "Sure")).toBe(false);
  });
});
