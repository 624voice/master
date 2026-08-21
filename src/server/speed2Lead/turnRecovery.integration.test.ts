import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner, ModelRunnerInput } from "~/server/speed2Lead/orchestrator";
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
const deployedNow = centralDateAt(2026, 8, 21, 10, 0, TZ);
const deployedPhone = "+15559876543";

let consultationSlots: string[] = [];
let bookingCalls = 0;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
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

mock.module("~/server/appointmentLifecycle/handleInbound", () => ({
  handleAppointmentLifecycleInbound: async () => ({ handled: false, sessionPersisted: false }),
}));

mock.module("~/server/speed2Lead/transcript", () => ({
  logSmsTranscriptSafely: () => {},
}));

const { handleInboundSms } = await import("~/server/speed2Lead/handleInbound");
const { saveSession, clearSession, getSession } = await import("~/server/speed2Lead/session");
const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");

function slot(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
}

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
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    orchestratorManagedQuestions: true,
    updatedAt: deployedNow.toISOString(),
    ...overrides,
  };
}

function emptyModel(): ModelRunner {
  return async () => ({
    output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
    outputText: "",
  });
}

function guardrailFailModel(): ModelRunner {
  return async () => ({
    output: [
      {
        type: "message" as const,
        role: "assistant" as const,
        content: [
          {
            type: "output_text" as const,
            text: "You're booked for Tuesday at 9am — see you then!",
          },
        ],
      },
    ],
    outputText: "You're booked for Tuesday at 9am — see you then!",
  });
}

function malformedModel(): ModelRunner {
  return async () => {
    throw new Error("malformed model response");
  };
}

async function runDeployed(
  inbound: string,
  session: ConversationContext,
  runModel: ModelRunner = emptyModel(),
) {
  resetSpeed2LeadIntegrationMocks();
  bookingCalls = 0;
  await clearSession(deployedPhone);
  await saveSession({ ...session, phone: deployedPhone });
  resetCapturedOutboundSms();
  await handleInboundSms(deployedPhone, inbound, { now: deployedNow, runModel });
  return getSession(deployedPhone);
}

beforeEach(() => {
  consultationSlots = [slot("2026-08-26", 14, 0), slot("2026-08-26", 15, 0)];
  resetSpeed2LeadIntegrationMocks();
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
  process.env.OPENAI_API_KEY = "test-key";
  resetSpeed2LeadTestPhonesCacheForTests();
});

describe("deployed safe turn recovery", () => {
  test("empty LLM response still sends a valid outbound", async () => {
    await runDeployed("Missed calls after hours", roiSession());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.trim().length).toBeGreaterThan(10);
  });

  test("guardrail-rejected LLM response falls back safely", async () => {
    await runDeployed("Missed calls after hours", roiSession(), guardrailFailModel());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/you(?:'re| are)? booked/);
  });

  test("malformed LLM result still sends a valid outbound", async () => {
    await runDeployed("Missed calls after hours", roiSession(), malformedModel());
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.trim().length).toBeGreaterThan(10);
  });

  test("discovery recovery preserves discovery state", async () => {
    const updated = await runDeployed("Missed calls after hours", roiSession(), emptyModel());
    expect(updated?.state).toBe("awaiting_problem");
    expect(updated?.knownFacts?.questionsAsked).toBeGreaterThanOrEqual(0);
    expect(updated?.scheduling?.status).not.toBe("confirmed");
  });

  test("scheduling recovery preserves offered slots through booking", async () => {
    const offered = [slot("2026-08-26", 14, 0), slot("2026-08-26", 15, 0)];
    const updated = await runDeployed(
      "The 2pm slot works",
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          offeredSlots: offered,
        },
      }),
      emptyModel(),
    );
    expect(updated?.scheduling?.status).toBe("confirmed");
    expect(updated?.scheduling?.selectedStart).toBeTruthy();
  });

  test("clear offered-slot selection still books when LLM output fails", async () => {
    const offered = [slot("2026-08-26", 14, 0), slot("2026-08-26", 15, 0)];
    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          offeredSlots: offered,
        },
      }),
      "The 2pm slot works",
      { now: deployedNow, runModel: guardrailFailModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.context.scheduling?.status).toBe("confirmed");
    }
  });

  test("soft-closed generic ack remains closed", async () => {
    const updated = await runDeployed(
      "ok",
      roiSession({ disposition: "soft_closed" }),
      emptyModel(),
    );
    expect(updated?.disposition).toBe("soft_closed");
  });

  test("confirmed booking remains confirmed on follow-up", async () => {
    const booked = slot("2026-08-26", 14, 0);
    const updated = await runDeployed(
      "thanks",
      roiSession({
        disposition: "booked",
        scheduling: {
          status: "confirmed",
          selectedStart: booked,
          calendarEventId: "evt-1",
        },
      }),
      emptyModel(),
    );
    expect(updated?.scheduling?.status).toBe("confirmed");
  });

  test("recovery does not send unauthorized calendar link", async () => {
    await runDeployed("Ready to book", roiSession(), emptyModel());
    expect(capturedOutboundSms[0]).not.toMatch(/https?:\/\//);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/grab a time here/i);
  });

  test("follow-up inbound continues from preserved state", async () => {
    await runDeployed("Missed calls after hours", roiSession(), emptyModel());
    resetCapturedOutboundSms();
    const updated = await runDeployed(
      "We try to call them back same day",
      (await getSession(deployedPhone)) as ConversationContext,
      emptyModel(),
    );
    expect(capturedOutboundSms.length).toBe(1);
    expect(updated?.state).toBe("awaiting_problem");
    expect(updated?.messages?.length).toBeGreaterThan(2);
  });
});
