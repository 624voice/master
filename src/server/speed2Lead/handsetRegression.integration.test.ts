import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  applyMeetingBridgeProgress,
  detectMeetingBridgeAgreement,
  meetingBridgeQuestionDelivered,
} from "~/server/speed2Lead/conversationHandoff";
import {
  resolveLlmTurnTask,
  shouldSendDeterministicSchedulingAsk,
} from "~/server/speed2Lead/conversationStage";
import { buildProviderUnavailableRecoveryMessage } from "~/server/speed2Lead/guardrails";
import { handleInboundSms } from "~/server/speed2Lead/handleInbound";
import { appendAssistantMessage, appendUserMessage } from "~/server/speed2Lead/memory";
import { orchestrateInboundTurn } from "~/server/speed2Lead/orchestrator";
import { extractNormalizedSchedulingIntent } from "~/server/speed2Lead/schedulingIntent";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingController";
import { clearSession, getSession, saveSession } from "~/server/speed2Lead/session";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import type { ConversationContext } from "~/server/speed2Lead/types";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";

installSpeed2LeadIntegrationMocks();

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const phone = "+15559876543";

let calendarApiFails = false;
let consultationSlots: string[] = [];

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

function scriptedModel(replies: string[]): ModelRunner {
  let index = 0;
  return async () => ({
    output: [],
    outputText: replies[Math.min(index++, replies.length - 1)] ?? replies[replies.length - 1]!,
  });
}

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
  calendarApiFails = false;
  consultationSlots = [];
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
  process.env.SPEED2LEAD_TEST_PHONES = phone;
});

describe("handset regression invariants", () => {
  test("A: operational answer advances to bridge task, not scheduling", () => {
    let session = roiSession({
      messages: [
        { role: "assistant", content: "Which part stood out most?", at: now.toISOString() },
        { role: "user", content: "prob missed calls", at: now.toISOString() },
        {
          role: "assistant",
          content: "What's your current process for handling calls that slip through?",
          at: now.toISOString(),
        },
      ],
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        questionsAsked: 1,
      },
    });
    session = appendUserMessage(session, "just manual");
    const plan = resolveLlmTurnTask(session, "just manual");
    expect(plan.stage).toBe("meeting_bridge");
    expect(plan.task).toBe("ask_conditional_meeting_bridge");
    expect(shouldSendDeterministicSchedulingAsk(session, "just manual")).toBe(false);
    expect(detectMeetingBridgeAgreement("more than they should but not sure for sure")).toBe(false);
  });

  test("B: bridge agreement without bridge delivery does not complete bridge", () => {
    const session = roiSession({
      knownFacts: { ...roiSession().knownFacts!, primaryPain: "manual", questionsAsked: 1 },
    });
    const updated = applyMeetingBridgeProgress(session, "Not sure");
    expect(updated.knownFacts?.meetingBridgeComplete).not.toBe(true);
    expect(shouldSendDeterministicSchedulingAsk(updated, "Not sure")).toBe(false);
  });

  test("C-D: Monday morning survives provider failure without daypart re-ask", () => {
    const intent = extractNormalizedSchedulingIntent({
      inboundMessage: "ok",
      scheduling: {
        status: "idle",
        centralDate: "2026-08-24",
        partOfDay: "morning",
        calendarUnavailable: true,
        providerFailureReason: "calendar_api_error",
      },
      now,
    });
    expect(intent.partOfDay).toBe("morning");
    expect(intent.centralDate).toBe("2026-08-24");

    const recovery = buildProviderUnavailableRecoveryMessage(
      roiSession({
        scheduling: {
          status: "idle",
          centralDate: "2026-08-24",
          partOfDay: "morning",
          calendarUnavailable: true,
        },
      }),
      false,
    );
    expect(recovery.toLowerCase()).not.toMatch(/morning or afternoon/);
    expect(recovery.toLowerCase()).not.toMatch(/shortly|will send|checking available/);
  });

  test("E: provider recovery never promises future outbound work", () => {
    const copy = buildProviderUnavailableRecoveryMessage(
      roiSession({
        scheduling: {
          status: "idle",
          centralDate: "2026-08-24",
          partOfDay: "morning",
          calendarUnavailable: true,
        },
      }),
      false,
    );
    expect(copy.toLowerCase()).not.toMatch(
      /shortly|within a couple|will send|checking available|get options over/,
    );
  });

  test("F-H: pricing question during scheduling defers authoritative calendar link", async () => {
    calendarApiFails = true;
    const session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: "2026-08-24",
        partOfDay: "morning",
        calendarUnavailable: true,
        availabilityAttempts: 2,
        providerFailureReason: "calendar_api_error",
      },
    });
    const runModel = scriptedModel([
      "Pricing depends on scope — we figure out what you actually need on a quick 25-minute walkthrough.",
    ]);
    const result = await orchestrateInboundTurn(session, "how does pricing work?", {
      now,
      runModel,
    });
    expect(result.reply.toLowerCase()).toMatch(/pricing|scope|depends/);
    expect(result.reply).not.toContain("calendar.app.google");
    expect(result.context.scheduling?.centralDate).toBe("2026-08-24");
    expect(result.context.scheduling?.partOfDay).toBe("morning");
  });

  test("G: substantive product question during scheduling is answered", async () => {
    const session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: "2026-08-24",
        partOfDay: "morning",
      },
    });
    const runModel = scriptedModel([
      "624Voice uses AI to respond faster and help book jobs — customized per business.",
    ]);
    const result = await orchestrateInboundTurn(session, "how does this work?", { now, runModel });
    expect(result.reply.toLowerCase()).toMatch(/ai|624voice|book/);
    expect(result.context.scheduling?.centralDate).toBe("2026-08-24");
  });

  test("I: calendar link only under authorized provider failure threshold", async () => {
    calendarApiFails = true;
    const session = roiSession({
      scheduling: {
        status: "idle",
        centralDate: "2026-08-24",
        partOfDay: "morning",
        calendarUnavailable: true,
        availabilityAttempts: 2,
        providerFailureReason: "calendar_api_error",
      },
    });
    const runModel = scriptedModel([""]);
    const result = await orchestrateInboundTurn(session, "still morning", { now, runModel });
    expect(result.reply).toContain("calendar.app.google/test");
  });

  test("deployed path: bridge then agreement then scheduling ask via handleInboundSms", async () => {
    await clearSession(phone);
    const bridgeLine =
      "Manual follow-up can leave gaps — worth a quick 25-minute look at tightening that with AI?";
    let session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        questionsAsked: 1,
      },
    });
    session = appendUserMessage(session, "just manual");
    await saveSession(session);

    const runModel = scriptedModel([bridgeLine, "What day works best for a quick 25-minute chat?"]);
    await handleInboundSms(phone, "just manual", { now, runModel });
    let updated = (await getSession(phone)) as ConversationContext;
    expect(meetingBridgeQuestionDelivered(updated)).toBe(true);
    expect(updated.knownFacts?.meetingBridgeComplete).not.toBe(true);

    await handleInboundSms(phone, "Sure", { now, runModel });
    updated = (await getSession(phone)) as ConversationContext;
    expect(updated.knownFacts?.meetingBridgeComplete).toBe(true);
    const lastAssistant = [...(updated.messages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    expect(lastAssistant?.content.toLowerCase()).toMatch(/what day works/);
    expect(lastAssistant?.content.toLowerCase()).not.toMatch(/worth a look|25-minute look/);
  });
});
