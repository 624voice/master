import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";
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
let availabilityMode: "ok" | "api_error" = "ok";
let availabilityCalls = 0;
let bookingCalls = 0;

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

function emptyModel(): ModelRunner {
  return async () => ({
    output: [{ type: "message" as const, role: "assistant" as const, content: [{ type: "output_text" as const, text: "" }] }],
    outputText: "",
  });
}

async function runDeployed(inbound: string, session: ConversationContext) {
  resetSpeed2LeadIntegrationMocks();
  availabilityCalls = 0;
  bookingCalls = 0;
  await clearSession(deployedPhone);
  await saveSession({ ...session, phone: deployedPhone });
  resetCapturedOutboundSms();
  await handleInboundSms(deployedPhone, inbound, { now: deployedNow, runModel: emptyModel() });
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

describe("deployed scheduling truth", () => {
  test("weekday only asks morning or afternoon without fetching availability", async () => {
    consultationSlots = [slot(mondayDate(), 10, 0)];
    await runDeployed("Can you do Monday", roiSession());
    expect(availabilityCalls).toBe(0);
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/morning|afternoon/);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b9:00|\b10:00|\b9am|\b10am/);
  });

  test("Monday afternoon fetches availability for Monday afternoon", async () => {
    consultationSlots = [slot(mondayDate(), 14, 0), slot(mondayDate(), 15, 0)];
    await runDeployed("Monday afternoon works", roiSession());
    expect(availabilityCalls).toBeGreaterThan(0);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b9:00|\b10:00|\b9am|\b10am/);
  });

  test("conversational no-afternoon correction selects afternoon instead of rejecting it", async () => {
    consultationSlots = [slot(mondayDate(), 14, 0), slot(mondayDate(), 15, 0)];
    const updated = await runDeployed(
      "No, afternoon please",
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "morning",
          offeredSlots: [slot(mondayDate(), 9, 0), slot(mondayDate(), 10, 0)],
        },
      }),
    );
    expect(updated?.scheduling?.partOfDay).toBe("afternoon");
    expect(updated?.scheduling?.rejectedPartOfDay ?? []).not.toContain("afternoon");
  });

  test("genuine afternoon rejection keeps afternoon in rejectedPartOfDay", async () => {
    const updated = await runDeployed(
      "Afternoons don't work for me",
      roiSession({
        scheduling: { status: "idle", centralDate: mondayDate(), partOfDay: "full_day" },
      }),
    );
    expect(updated?.scheduling?.rejectedPartOfDay).toContain("afternoon");
    expect(updated?.scheduling?.partOfDay).not.toBe("afternoon");
  });

  test("Tuesday change clears Monday stale slots and incompatible rejections", async () => {
    consultationSlots = [slot(tuesdayDate(), 14, 0), slot(tuesdayDate(), 15, 0)];
    const updated = await runDeployed(
      "How about Tuesday instead",
      roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: mondayDate(),
          partOfDay: "afternoon",
          rejectedPartOfDay: ["afternoon"],
          offeredSlots: [slot(mondayDate(), 9, 0)],
          activeRequestKey: `date:${mondayDate()}|afternoon`,
        },
      }),
    );
    expect(updated?.scheduling?.centralDate).toBe(tuesdayDate());
    expect(updated?.scheduling?.rejectedPartOfDay ?? []).not.toContain("afternoon");
    expect(updated?.scheduling?.offeredSlots?.every((s) => s.includes("2026-08-25")) ?? true).toBe(true);
  });

  test("provider API error does not produce false nothing-open reply", async () => {
    availabilityMode = "api_error";
    await runDeployed(
      "Monday afternoon",
      roiSession({ scheduling: { status: "idle", centralDate: mondayDate(), partOfDay: "afternoon" } }),
    );
    expect(capturedOutboundSms.length).toBe(1);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/don't have anything open|nothing open/);
  });

  test("explicit afternoon state does not output morning slots", async () => {
    consultationSlots = [
      slot(tuesdayDate(), 9, 0),
      slot(tuesdayDate(), 14, 0),
      slot(tuesdayDate(), 15, 0),
    ];
    await runDeployed(
      "Tuesday afternoon",
      roiSession({ scheduling: { status: "idle", centralDate: tuesdayDate(), partOfDay: "afternoon" } }),
    );
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/\b9:00|\b9am|\b10:00|\b10am/);
  });
});
