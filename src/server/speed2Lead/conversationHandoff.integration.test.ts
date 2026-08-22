import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { initialMessage } from "~/server/speed2Lead/messages";
import type { ModelRunner, ModelRunnerInput } from "~/server/speed2Lead/orchestrator";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetCapturedOutboundSms,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import { countProspectNameMentions } from "~/server/speed2Lead/conversationHandoff";
import {
  nextOpenBusinessDayAfter,
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";

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
      primaryPain: "Missed calls",
      questionsAsked: 1,
      meetingBridgeComplete: true,
    },
    scheduling: { status: "idle" },
    orchestratorManagedQuestions: true,
    updatedAt: deployedNow.toISOString(),
    ...overrides,
  };
}

function bridgePendingSession(): ConversationContext {
  return roiSession({
    knownFacts: {
      ...roiSession().knownFacts!,
      meetingBridgeComplete: undefined,
      primaryPain: "Missed calls",
      questionsAsked: 1,
    },
    messages: [
      {
        role: "assistant",
        content: "What usually happens when a new lead calls?",
        at: deployedNow.toISOString(),
      },
      { role: "user", content: "They go to voicemail after hours", at: deployedNow.toISOString() },
    ],
  });
}

function emptyModel(): ModelRunner {
  return async () => ({
    output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
    outputText: "",
  });
}

function passthroughModel(): ModelRunner {
  return async (input: ModelRunnerInput) => ({
    output: [
      {
        type: "message" as const,
        role: "assistant" as const,
        content: [{ type: "output_text" as const, text: input.messages.at(-1)?.content ?? "ok" }],
      },
    ],
    outputText: input.messages.at(-1)?.content ?? "ok",
  });
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
  consultationSlots = [
    slot(nextWeekdayCentral("friday", deployedNow), 14, 0),
    slot(nextWeekdayCentral("friday", deployedNow), 15, 0),
    slot(nextOpenBusinessDayAfter(tomorrowCentralDate(deployedNow)), 14, 0),
    slot(nextOpenBusinessDayAfter(tomorrowCentralDate(deployedNow)), 15, 0),
  ];
  resetSpeed2LeadIntegrationMocks();
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
  process.env.OPENAI_API_KEY = "test-key";
  resetSpeed2LeadTestPhonesCacheForTests();
});

describe("deployed conversation + scheduling handoff", () => {
  test("revised ROI opening invites report reaction with one question", () => {
    const opening = initialMessage(roiSession());
    expect(opening).toMatch(/which part stood out most/i);
    expect(opening).toMatch(/roi report/i);
    expect(opening).not.toMatch(/what usually happens first/i);
    expect((opening.match(/\?/g) ?? []).length).toBe(1);
  });

  test("clear pain blocks premature scheduling until bridge completes", async () => {
    const updated = await runDeployed(
      "They go to voicemail when everyone is busy",
      bridgePendingSession(),
      passthroughModel(),
    );
    expect(updated?.knownFacts?.meetingBridgeComplete).not.toBe(true);
    expect(updated?.scheduling?.centralDate).toBeUndefined();
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/what day works best/);
  });

  test("explicit meeting request skips bridge and reaches scheduling", async () => {
    const updated = await runDeployed(
      "How does next Friday look",
      bridgePendingSession(),
      emptyModel(),
    );
    expect(updated?.knownFacts?.meetingBridgeComplete).toBe(true);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/morning or afternoon/);
    expect(capturedOutboundSms[0]).not.toMatch(/https?:\/\//);
  });

  test("date known + afternoon please fetches without repeated daypart ask", async () => {
    const friday = nextWeekdayCentral("friday", deployedNow);
    const updated = await runDeployed(
      "Let's do afternoon please",
      roiSession({ scheduling: { status: "idle", centralDate: friday } }),
      emptyModel(),
    );
    expect(updated?.scheduling?.partOfDay).toBe("afternoon");
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/morning or afternoon\?/);
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/pm|afternoon|\d/);
  });

  test("morning preference also resolves without repeat ask", async () => {
    const friday = nextWeekdayCentral("friday", deployedNow);
    consultationSlots = [
      slot(friday, 9, 0),
      slot(friday, 10, 0),
    ];
    const updated = await runDeployed(
      "Morning would be best",
      roiSession({ scheduling: { status: "idle", centralDate: friday } }),
      emptyModel(),
    );
    expect(updated?.scheduling?.partOfDay).toBe("morning");
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/morning or afternoon\?/);
  });

  test("prospect name not repeated in scheduling preference outbound", async () => {
    await runDeployed("How does next Friday look", bridgePendingSession(), emptyModel());
    expect(countProspectNameMentions(capturedOutboundSms[0] ?? "", "Alex")).toBe(0);
  });

  test("Saturday request explains closed day and offers weekday path", async () => {
    const saturday = tomorrowCentralDate(deployedNow);
    await runDeployed(
      "Tomorrow afternoon",
      roiSession({ knownFacts: { ...roiSession().knownFacts!, meetingBridgeComplete: true } }),
      emptyModel(),
    );
    expect(capturedOutboundSms[0]?.toLowerCase()).toMatch(/weekday|monday|tuesday|wednesday|thursday|friday/);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(
      /don't have anything open in that window/i,
    );
  });

  test("weekday with zero availability uses availability-full wording", async () => {
    consultationSlots = [];
    const tuesday = nextWeekdayCentral("tuesday", deployedNow);
    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: { status: "idle", centralDate: tuesday, partOfDay: "afternoon" },
      }),
      "Tuesday afternoon",
      { now: deployedNow, runModel: emptyModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.reply.toLowerCase()).toMatch(/nothing open|another time/);
      expect(result.reply.toLowerCase()).not.toMatch(/weekday|saturday|sunday/);
    }
  });

  test("clear slot selection still books when model output fails", async () => {
    const friday = nextWeekdayCentral("friday", deployedNow);
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
      { now: deployedNow, runModel: emptyModel() },
    );
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.context.scheduling?.status).toBe("confirmed");
    }
  });

  test("no unauthorized calendar link on scheduling recovery", async () => {
    await runDeployed(
      "How does next Friday look",
      bridgePendingSession(),
      emptyModel(),
    );
    expect(capturedOutboundSms[0]).not.toMatch(/https?:\/\//);
    expect(capturedOutboundSms[0]?.toLowerCase()).not.toMatch(/grab a time here/i);
  });
});
