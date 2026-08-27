import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { orchestrateInboundTurn, type ModelRunner } from "~/server/speed2Lead/orchestrator";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import type { ConversationContext } from "~/server/speed2Lead/types";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const phoneA = "+15551111001";
const phoneB = "+15551111002";

const slotStore = new Map<string, string[]>();

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    const startMs = new Date(input.rangeStart).getTime();
    const endMs = new Date(input.rangeEnd).getTime();
    const all = [...slotStore.values()].flat();
    return {
      ok: true,
      slots: all.filter((slot) => {
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
    eventId: `evt-${input.start.slice(-8)}`,
    selectedStart: input.start,
    googleMeetUrl: "https://meet.google.com/test-isolated",
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

function slot(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
}

function roiSession(phone: string, date: string, part: "morning" | "afternoon"): ConversationContext {
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
      meetingInterestConfirmed: true,
      diagnosticQuestionsAsked: 1,
      discoveryPhase: "scheduling",
    },
    scheduling: { status: "idle", centralDate: date, partOfDay: part },
    updatedAt: now.toISOString(),
  };
}

const emptyModel: ModelRunner = async () => ({ output: [], outputText: "" });

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
  slotStore.clear();
  slotStore.set("thursday", [slot("2026-08-27", 9, 0), slot("2026-08-27", 9, 45)]);
  slotStore.set("friday", [slot("2026-08-28", 14, 0), slot("2026-08-28", 15, 0)]);
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = `${phoneA},${phoneB}`;
  process.env.OPENAI_API_KEY = "test-key";
});

describe("session isolation", () => {
  test("two simultaneous sessions keep dates, constraints, and offers separate", async () => {
    const thursday = await orchestrateInboundTurn(
      roiSession(phoneA, "2026-08-27", "morning"),
      "Thursday morning",
      { now, runModel: emptyModel },
    );
    const friday = await orchestrateInboundTurn(
      roiSession(phoneB, "2026-08-28", "afternoon"),
      "Friday afternoon",
      { now, runModel: emptyModel },
    );

    expect(thursday.context.scheduling?.centralDate).toBe("2026-08-27");
    expect(friday.context.scheduling?.centralDate).toBe("2026-08-28");
    expect(thursday.context.scheduling?.partOfDay).toBe("morning");
    expect(friday.context.scheduling?.partOfDay).toBe("afternoon");
    expect(thursday.context.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);
    expect(friday.context.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);
    expect(thursday.context.scheduling?.offeredSlots).not.toEqual(friday.context.scheduling?.offeredSlots);

    const bookA = await orchestrateInboundTurn(
      {
        ...thursday.context,
        scheduling: {
          ...thursday.context.scheduling!,
          status: "slots_offered",
        },
      },
      "9am",
      { now, runModel: emptyModel },
    );
    expect(bookA.context.scheduling?.status).toBe("confirmed");
    expect(friday.context.scheduling?.status).not.toBe("confirmed");
    expect(friday.context.phone).toBe(phoneB);
    expect(bookA.context.phone).toBe(phoneA);
  });
});
