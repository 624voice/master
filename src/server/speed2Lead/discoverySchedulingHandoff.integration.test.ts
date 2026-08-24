import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner, ModelRunnerInput } from "~/server/speed2Lead/orchestrator";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";
import {
  calendarLinkFallbackMessage,
  finalizeCalendarLinkOutbound,
  isBrokenSelfSchedulingOutbound,
} from "~/server/speed2Lead/guardrails";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetCapturedOutboundSms,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const deployedNow = centralDateAt(2026, 8, 21, 10, 0, TZ);
const deployedPhone = "+15559876543";

let consultationSlots: string[] = [];
let availabilityMode: "ok" | "api_error" = "ok";
let availabilityCalls = 0;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    availabilityCalls += 1;
    if (availabilityMode === "api_error") {
      return { ok: false, reason: "calendar_api_error", detail: "403 forbidden" };
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
  bookConsultation: async () => ({
    ok: true,
    eventId: "evt-1",
    selectedStart: "",
    googleMeetUrl: "https://meet.google.com/test-abc-defg-hij",
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
const { saveSession, clearSession, getSession } = await import("~/server/speed2Lead/session");
const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone: deployedPhone,
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
      phone: deployedPhone,
      flow: "roi",
      businessName: "Test Plumbing",
      customerGoal: "Missed calls",
      primaryPain: "Missed calls",
      fit: "yes",
      questionsAsked: 1,
    },
    scheduling: { status: "idle" },
    orchestratorManagedQuestions: true,
    updatedAt: deployedNow.toISOString(),
    ...overrides,
  };
}

function discoveryAfterPain(pain: "Missed calls" | "Slow response"): ConversationContext {
  const primaryPain = pain;
  return roiSession({
    knownFacts: {
      ...roiSession().knownFacts!,
      primaryPain,
      customerGoal: pain,
      questionsAsked: 1,
      meetingBridgeComplete: true,
    },
    messages: [
      {
        role: "assistant",
        content: "Where are you losing opportunities?",
        at: deployedNow.toISOString(),
      },
      { role: "user", content: pain, at: deployedNow.toISOString() },
      {
        role: "assistant",
        content: "What's your process now when a new lead calls or texts?",
        at: deployedNow.toISOString(),
      },
    ],
  });
}

function modelThatPrematurelyChecksCalendar(): ModelRunner {
  return async (input: ModelRunnerInput) => {
    if (input.tools.length > 0) {
      return {
        output: [
          {
            type: "function_call" as const,
            name: "get_availability",
            call_id: "call-1",
            arguments: JSON.stringify({
              rangeStart: null,
              rangeEnd: null,
              centralDate: "2026-08-24",
              partOfDay: "full_day",
              maxSlots: 3,
            }),
          },
        ],
        outputText: calendarLinkFallbackMessage(roiSession()),
      };
    }
    return {
      output: [
        {
          type: "message" as const,
          role: "assistant" as const,
          content: [{ type: "output_text" as const, text: "" }],
        },
      ],
      outputText: "",
    };
  };
}

async function runDeployed(
  inbound: string,
  session: ConversationContext,
  runModel: ModelRunner = modelThatPrematurelyChecksCalendar(),
) {
  resetSpeed2LeadIntegrationMocks();
  availabilityCalls = 0;
  await clearSession(deployedPhone);
  await saveSession({ ...session, phone: deployedPhone });
  resetCapturedOutboundSms();
  await handleInboundSms(deployedPhone, inbound, { now: deployedNow, runModel });
  return getSession(deployedPhone);
}

beforeEach(() => {
  consultationSlots = [];
  availabilityMode = "ok";
  resetSpeed2LeadIntegrationMocks();
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
  process.env.OPENAI_API_KEY = "test-key";
  resetSpeed2LeadTestPhonesCacheForTests();
});

describe("deployed discovery→scheduling handoff", () => {
  test("missed-call operational answer transitions to conversational scheduling", async () => {
    availabilityMode = "api_error";
    const updated = await runDeployed(
      "We try to call them back same day",
      discoveryAfterPain("Missed calls"),
    );
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/what day|morning or afternoon/);
    expect(capturedOutboundSms[0]).not.toMatch(/grab a time here/i);
    expect(capturedOutboundSms[0]).not.toMatch(/https?:\/\//);
    expect(updated?.scheduling?.lastBlockedFallback).not.toBe(true);
  });

  test("slow-response operational answer transitions to conversational scheduling", async () => {
    availabilityMode = "api_error";
    const updated = await runDeployed(
      "We just try to get back to them asap",
      discoveryAfterPain("Slow response"),
    );
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/what day|morning or afternoon/);
    expect(capturedOutboundSms[0]).not.toMatch(/grab a time here/i);
    expect(updated?.scheduling?.lastBlockedFallback).not.toBe(true);
  });

  test("no date known asks day without fetching availability", async () => {
    availabilityMode = "ok";
    await runDeployed("We just try to get back to them asap", discoveryAfterPain("Slow response"));
    expect(availabilityCalls).toBe(0);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/what day/);
  });

  test("blocked calendar-link fallback cannot emit dangling copy", () => {
    const dangling = finalizeCalendarLinkOutbound(
      calendarLinkFallbackMessage(roiSession()),
      roiSession(),
      false,
    );
    expect(dangling).toBeNull();
    expect(isBrokenSelfSchedulingOutbound("No problem, Alex. If it's easier, you can grab a time here:", false)).toBe(
      true,
    );
  });

  test("blocked link falls through to conversational scheduling, not silence", async () => {
    availabilityMode = "api_error";
    await runDeployed("We just try to get back to them asap", discoveryAfterPain("Slow response"));
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.trim().length).toBeGreaterThan(10);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/what day|morning or afternoon/);
  });

  test("healthy calendar path does not send self-scheduling link on discovery transition", async () => {
    consultationSlots = [centralDateAt(2026, 8, 24, 14, 0, TZ).toISOString()];
    availabilityMode = "ok";
    await runDeployed("We just try to get back to them asap", discoveryAfterPain("Slow response"));
    expect(capturedOutboundSms[0]).not.toMatch(/https?:\/\//);
    expect(capturedOutboundSms[0]).not.toMatch(/grab a time here/i);
  });

  test("failed fallback does not repeat on confused follow-up", async () => {
    availabilityMode = "api_error";
    let session = discoveryAfterPain("Slow response");
    session = {
      ...session,
      messages: [
        ...(session.messages ?? []),
        {
          role: "assistant",
          content: "No problem, Alex. If it's easier, you can grab a time here:",
          at: deployedNow.toISOString(),
        },
      ],
      scheduling: {
        status: "idle",
        availabilityAttempts: 1,
        calendarUnavailable: true,
        lastBlockedFallback: true,
      },
    };

    const updated = await runDeployed("Makes no sense", session);
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]).not.toBe(
      "No problem, Alex. If it's easier, you can grab a time here:",
    );
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/what day|morning or afternoon/);
    expect(updated?.scheduling?.lastBlockedFallback).not.toBe(true);
  });

  test("substantive inbound after blocked fallback is processed normally", async () => {
    const session = roiSession({
      scheduling: {
        status: "idle",
        lastBlockedFallback: true,
        centralDate: "2026-08-24",
      },
      messages: [
        {
          role: "assistant",
          content: "No problem, Alex. If it's easier, you can grab a time here:",
          at: deployedNow.toISOString(),
        },
      ],
    });
    const updated = await runDeployed("Monday afternoon works", session);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/grab a time here/i);
    expect(updated?.scheduling?.lastBlockedFallback).not.toBe(true);
  });

  test("one inbound yields one authoritative outbound", async () => {
    await runDeployed("We just try to get back to them asap", discoveryAfterPain("Missed calls"));
    expect(capturedOutboundSms.length).toBe(1);
  });

  test("discovery state does not restart unnecessarily", async () => {
    const updated = await runDeployed(
      "We just try to get back to them asap",
      discoveryAfterPain("Missed calls"),
    );
    expect(updated?.knownFacts?.primaryPain).toMatch(/missed calls/i);
    expect(updated?.knownFacts?.discoveryPhase).not.toBe("awaiting_report_reaction");
    expect(updated?.state).toBe("awaiting_problem");
  });
});

describe("deployed orchestrator ownership", () => {
  test("unauthorized get_availability tool call is rejected during ask_preference gate", async () => {
    availabilityMode = "api_error";
    const result = await orchestrateInboundTurn(
      discoveryAfterPain("Slow response"),
      "We just try to get back to them asap",
      { now: deployedNow, runModel: modelThatPrematurelyChecksCalendar() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply.toLowerCase()).toMatch(/what day|morning or afternoon/);
      expect(result.reply).not.toMatch(/grab a time here/i);
    }
    expect(availabilityCalls).toBe(0);
  });
});
