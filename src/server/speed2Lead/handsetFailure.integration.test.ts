import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  allowCalendarLinkFallback,
  planSchedulingGate,
} from "~/server/speed2Lead/schedulingController";
import { prepareInboundSchedulingTurn } from "~/server/speed2Lead/schedulingIntent";
import {
  nextWeekdayCentral,
} from "~/server/speed2Lead/schedulingRange";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import type { ConversationContext } from "~/server/speed2Lead/types";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const deployedPhone = "+15559876543";

let consultationSlots: string[] = [];
let bookingCalls = 0;
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

async function runDeployed(
  inbound: string,
  session: ConversationContext,
  runModel: Parameters<typeof handleInboundSms>[2] extends infer O
    ? O extends { runModel?: infer R }
      ? R
      : never
    : never,
) {
  resetSpeed2LeadIntegrationMocks();
  bookingCalls = 0;
  calendarApiFails = false;
  await clearSession(deployedPhone);
  await saveSession({ ...session, phone: deployedPhone });
  await handleInboundSms(deployedPhone, inbound, { now, runModel: runModel as never });
  return getSession(deployedPhone);
}

beforeEach(() => {
  consultationSlots = [
    slot(nextWeekdayCentral("tuesday", now), 14, 0),
    slot(nextWeekdayCentral("tuesday", now), 15, 0),
    slot(nextWeekdayCentral("wednesday", now), 14, 0),
    slot(nextWeekdayCentral("wednesday", now), 15, 0),
    slot(nextWeekdayCentral("friday", now), 14, 0),
    slot(nextWeekdayCentral("friday", now), 15, 0),
  ];
  resetSpeed2LeadIntegrationMocks();
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
  process.env.OPENAI_API_KEY = "test-key";
});

describe("handset failure class A–J deployed-path replays", () => {
  test("B: Tuesday afternoon fetches immediately with both facts in state", async () => {
    const updated = await runDeployed("Tuesday afternoon", roiSession({
      knownFacts: { ...roiSession().knownFacts!, meetingBridgeComplete: true },
    }), emptyModel());
    expect(updated?.scheduling?.centralDate).toBeTruthy();
    expect(updated?.scheduling?.partOfDay).toBe("afternoon");
    expect(updated?.scheduling?.status).toBe("slots_offered");
  });

  test("C: known Friday + afternoon please fetches without daypart re-ask", async () => {
    const friday = nextWeekdayCentral("friday", now);
    const updated = await runDeployed(
      "Let's do afternoon please",
      roiSession({ scheduling: { status: "idle", centralDate: friday } }),
      emptyModel(),
    );
    expect(updated?.scheduling?.partOfDay).toBe("afternoon");
    expect(updated?.scheduling?.status).toBe("slots_offered");
  });

  test("D: known Wednesday + afternoon does not require second afternoon", async () => {
    const wednesday = nextWeekdayCentral("wednesday", now);
    const context = prepareInboundSchedulingTurn(
      roiSession({ scheduling: { status: "idle", centralDate: wednesday } }),
      "Afternoon",
      now,
    );
    const plan = planSchedulingGate({ inboundMessage: "Afternoon", context, now });
    expect(plan.action.type).toBe("get_availability");
    expect(plan.action.type === "get_availability" && plan.action.input.partOfDay).toBe("afternoon");
  });

  test("E: parser ambiguity with incomplete facts cannot authorize calendar link", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Maybe later",
      context: roiSession(),
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: { ...createInitialToolState(), availabilityAttempts: 2, offeredSlots: [] },
        context: roiSession(),
      }),
    ).toBe(false);
  });

  test("F: application logic failure cannot authorize calendar link", () => {
    const context = roiSession({
      scheduling: {
        status: "idle",
        centralDate: nextWeekdayCentral("wednesday", now),
        partOfDay: "afternoon",
        applicationLogicFailure: true,
      },
    });
    const plan = planSchedulingGate({
      inboundMessage: "Afternoon",
      context,
      now,
    });
    expect(
      allowCalendarLinkFallback({
        plan,
        toolState: {
          ...createInitialToolState(),
          calendarUnavailable: true,
          availabilityAttempts: 3,
          offeredSlots: [],
        },
        context,
      }),
    ).toBe(false);
  });

  test("G: real provider failure may authorize calendar link after policy threshold", () => {
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

  test("H: exact time with known date uses direct availability path", async () => {
    const tuesday = nextWeekdayCentral("tuesday", now);
    consultationSlots = [slot(tuesday, 14, 0), slot(tuesday, 15, 0)];
    const result = await orchestrateInboundTurn(
      roiSession({
        knownFacts: { ...roiSession().knownFacts!, meetingBridgeComplete: true },
        scheduling: { status: "idle", centralDate: tuesday },
      }),
      "How about 2pm",
      { now, runModel: emptyModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.context.scheduling?.anchorTimeMinutes ?? 0).toBeGreaterThan(0);
    }
  });

  test("I: clear slot selection books same turn", async () => {
    const friday = nextWeekdayCentral("friday", now);
    const offered = [slot(friday, 14, 0), slot(friday, 15, 0)];
    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: friday,
          partOfDay: "afternoon",
          offeredSlots: offered,
        },
      }),
      "2pm works",
      { now, runModel: emptyModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.context.scheduling?.status).toBe("confirmed");
    }
  });

  test("J: booking confirmation is sent once without repeated name in scheduling", async () => {
    const friday = nextWeekdayCentral("friday", now);
    const offered = [slot(friday, 14, 0)];
    consultationSlots = offered;
    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: friday,
          partOfDay: "afternoon",
          offeredSlots: offered,
        },
      }),
      "2pm works",
      { now, runModel: emptyModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply.match(/Alex/gi)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(result.context.scheduling?.status).toBe("confirmed");
    }
  });
});
