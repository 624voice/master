import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { initialMessage } from "~/server/speed2Lead/messages";
import type { ModelRunner, ModelRunnerInput } from "~/server/speed2Lead/orchestrator";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { countProspectNameMentions } from "~/server/speed2Lead/conversationHandoff";
import { extractNormalizedSchedulingIntent } from "~/server/speed2Lead/schedulingIntent";
import { nextWeekdayCentral } from "~/server/speed2Lead/schedulingRange";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetCapturedOutboundSms,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const deployedPhone = "+15559876543";

let consultationSlots: string[] = [];
let bookingCalls = 0;
const outboundReplies: string[] = [];

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

function slot(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
}

function freshRoiSession(): ConversationContext {
  const opening = initialMessage({
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
    updatedAt: now.toISOString(),
  });
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
    messages: [{ role: "assistant", content: opening, at: now.toISOString() }],
    knownFacts: {
      firstName: "Alex",
      phone: deployedPhone,
      flow: "roi",
      businessName: "Test Plumbing",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    orchestratorManagedQuestions: true,
    updatedAt: now.toISOString(),
  };
}

function discoveryBridgeModel(): ModelRunner {
  return async (input: ModelRunnerInput) => {
    const lastUser = [...input.input].reverse().find((m) => "role" in m && m.role === "user");
    const text =
      typeof lastUser === "object" && lastUser && "content" in lastUser
        ? String(lastUser.content ?? "")
        : "";

    if (/missed calls/i.test(text)) {
      return {
        output: [
          {
            type: "function_call" as const,
            call_id: "facts-1",
            name: "update_known_facts",
            arguments: JSON.stringify({
              primaryPain: "Missed calls",
              customerGoal: "Missed calls",
              questionsAsked: 1,
            }),
          },
        ],
        outputText: "",
      };
    }

    if (/voicemail|nobody calls back/i.test(text)) {
      return {
        output: [
          {
            type: "function_call" as const,
            call_id: "facts-2",
            name: "update_known_facts",
            arguments: JSON.stringify({ questionsAsked: 1 }),
          },
        ],
        outputText:
          "If there were a practical way to capture more of those after-hours leads without adding headcount, would a quick 25-minute look be worth it?",
      };
    }

    if (/worth a look|yeah|yes/i.test(text)) {
      return {
        output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
        outputText: "What day works best for a quick 25-minute chat?",
      };
    }

    return {
      output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
      outputText: "",
    };
  };
}

async function sendInbound(inbound: string, runModel: ModelRunner) {
  resetCapturedOutboundSms();
  await handleInboundSms(deployedPhone, inbound, { now, runModel });
  const reply = capturedOutboundSms.at(-1) ?? "";
  outboundReplies.push(reply);
  return { reply, session: await getSession(deployedPhone) };
}

beforeEach(async () => {
  const tuesday = nextWeekdayCentral("tuesday", now);
  consultationSlots = [slot(tuesday, 14, 0), slot(tuesday, 15, 0), slot(tuesday, 14, 30)];
  bookingCalls = 0;
  outboundReplies.length = 0;
  resetSpeed2LeadIntegrationMocks();
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = deployedPhone;
  process.env.OPENAI_API_KEY = "test-key";
  resetSpeed2LeadTestPhonesCacheForTests();
  await clearSession(deployedPhone);
  await saveSession(freshRoiSession());
});

describe("case A — full ROI deployed path", () => {
  test("report reaction through booking without calendar-link fallback or known-fact re-asks", async () => {
    const model = discoveryBridgeModel();
    const tuesday = nextWeekdayCentral("tuesday", now);

    const turn1 = await sendInbound("Missed calls after hours", model);
    expect(turn1.session?.knownFacts?.primaryPain).toMatch(/missed calls/i);
    expect(turn1.reply.match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(turn1.reply.toLowerCase()).not.toMatch(/fast response.*covered|you've got.*covered/);
    expect(turn1.session?.scheduling?.centralDate).toBeUndefined();

    const turn2 = await sendInbound("Usually goes to voicemail and nobody calls back same day", model);
    expect(turn2.session?.knownFacts?.meetingBridgeComplete).not.toBe(true);
    expect(turn2.reply.toLowerCase()).toMatch(/worth|25-minute|look/);
    expect(turn2.reply).not.toMatch(/https?:\/\//);

    const turn3 = await sendInbound("Yeah worth a look", model);
    expect(turn3.session?.knownFacts?.meetingBridgeComplete).toBe(true);
    expect(turn3.reply.toLowerCase()).toMatch(/what day|day works/);

    const turn4 = await sendInbound("Tuesday afternoon", async () => ({
      output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
      outputText: "",
    }));
    const normalized = extractNormalizedSchedulingIntent({
      inboundMessage: "Tuesday afternoon",
      scheduling: turn4.session?.scheduling,
      now,
    });
    expect(normalized.centralDate).toBe(tuesday);
    expect(normalized.partOfDay).toBe("afternoon");
    expect(turn4.session?.scheduling?.centralDate).toBe(tuesday);
    expect(turn4.session?.scheduling?.partOfDay).toBe("afternoon");
    expect(turn4.session?.scheduling?.status).toBe("slots_offered");
    expect(turn4.session?.scheduling?.offeredSlots?.length ?? 0).toBeGreaterThan(0);
    expect(turn4.reply.toLowerCase()).not.toMatch(/morning or afternoon\?/);
    expect(turn4.reply).not.toMatch(/https?:\/\//);

    const turn5 = await sendInbound("2pm works", async () => ({
      output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
      outputText: "",
    }));
    expect(turn5.session?.scheduling?.status).toBe("confirmed");
    expect(bookingCalls).toBe(1);
    expect(turn5.reply.toLowerCase()).not.toMatch(/morning or afternoon|what day works|grab a time here/);

    const combined = outboundReplies.join("\n").toLowerCase();
    expect(combined).not.toMatch(/grab a time here|calendar\.app\.google/);
    expect(combined.match(/morning or afternoon/g)?.length ?? 0).toBeLessThanOrEqual(1);

    for (const reply of outboundReplies.slice(1, -1)) {
      expect(countProspectNameMentions(reply, "Alex")).toBe(0);
    }
    expect(countProspectNameMentions(outboundReplies.at(-1) ?? "", "Alex")).toBeLessThanOrEqual(1);
  });

  test("explicit meeting intent skips bridge before scheduling", async () => {
    await saveSession({
      ...freshRoiSession(),
      knownFacts: {
        ...freshRoiSession().knownFacts!,
        primaryPain: "Missed calls",
        questionsAsked: 1,
      },
      messages: [
        ...freshRoiSession().messages,
        { role: "user", content: "Missed calls", at: now.toISOString() },
        {
          role: "assistant",
          content: "What happens when nobody can answer right away?",
          at: now.toISOString(),
        },
        { role: "user", content: "Voicemail", at: now.toISOString() },
      ],
    });

    const result = await sendInbound("How does next Friday look", async () => ({
      output: [{ type: "message" as const, role: "assistant" as const, content: [] }],
      outputText: "",
    }));
    expect(result.session?.knownFacts?.meetingBridgeComplete).toBe(true);
    expect(result.reply.toLowerCase()).toMatch(/morning or afternoon|pm|\d/);
    expect(result.reply).not.toMatch(/https?:\/\//);
  });
});
