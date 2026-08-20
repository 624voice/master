import { describe, expect, test, mock, beforeAll } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  assertEvalHarnessSafe,
  buildEnvironmentSafetyReport,
} from "~/server/speed2Lead/eval/environmentSafety";
import { LIVE_EVAL_SCENARIOS, type LiveEvalScenario } from "~/server/speed2Lead/eval/scenarios";
import {
  categoryAverage,
  scoreScenario,
  type ScenarioScore,
  type TranscriptTurn,
} from "~/server/speed2Lead/eval/scoring";
import { appendAssistantMessage, appendUserMessage } from "~/server/speed2Lead/memory";
import { getSpeed2LeadLlmModel } from "~/server/speed2Lead/config";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const EVAL_NOW = centralDateAt(2026, 8, 19, 10, 0, TZ);
const LIVE_EVAL_ENABLED = process.env.S2L_LIVE_EVAL === "true";

let consultationSlots: string[] = [];
let availabilityMode: "ok" | "unconfigured" = "ok";
let bookingShouldFail = false;
let bookingCalls = 0;

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    if (availabilityMode === "unconfigured") {
      return { ok: false, reason: "not_configured" };
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
}));

mock.module("~/server/appointmentLifecycle/bookConsultation", () => ({
  bookConsultation: async (input: { start: string }) => {
    bookingCalls += 1;
    if (bookingShouldFail) {
      return { ok: false, reason: "slot_unavailable" };
    }
    return {
      ok: true,
      eventId: `eval-${bookingCalls}`,
      selectedStart: input.start,
      replayed: false,
      lifecycle: { action: "created", smsSent: false },
    };
  },
}));

const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");

function toolStateFromContext(context: AnyConversationContext) {
  const scheduling = context.scheduling ?? { status: "idle" as const };
  return {
    ...createInitialToolState(),
    offeredSlots: scheduling.offeredSlots ?? [],
    bookingConfirmed: scheduling.status === "confirmed",
    bookingStart: scheduling.selectedStart,
    bookingEventId: scheduling.calendarEventId,
    calendarUnavailable: scheduling.calendarUnavailable ?? availabilityMode === "unconfigured",
    availabilityAttempts: scheduling.availabilityAttempts ?? 0,
    bookingAttempts: scheduling.bookingAttempts ?? 0,
  };
}

async function runScenario(scenario: LiveEvalScenario): Promise<{
  transcript: TranscriptTurn[];
  finalContext: AnyConversationContext;
  score: ScenarioScore;
}> {
  consultationSlots = scenario.presetSlots?.(EVAL_NOW) ?? [];
  availabilityMode = scenario.calendarMode === "unconfigured" ? "unconfigured" : "ok";
  bookingShouldFail = scenario.calendarMode === "slot_conflict";

  let context = scenario.buildSession(EVAL_NOW);
  if (scenario.openingMessage) {
    context = appendAssistantMessage(context, scenario.openingMessage(context));
  }

  const transcript: TranscriptTurn[] = [];

  for (const customerTurn of scenario.customerTurns) {
    context = appendUserMessage(context, customerTurn);
    const result = await orchestrateInboundTurn(context, customerTurn, { now: EVAL_NOW });

    if (!result.handled) {
      if ("context" in result && result.context) {
        context = result.context;
      }
      transcript.push({
        customer: customerTurn,
        agent: `[FALLBACK:${result.reason}]`,
        handled: false,
        fallbackReason: result.reason,
      });
      break;
    }

    context = result.context;
    context = appendAssistantMessage(context, result.reply);
    transcript.push({
      customer: customerTurn,
      agent: result.reply,
      handled: true,
    });
  }

  const score = scoreScenario({
    transcript,
    expectations: scenario.expectations,
    finalContext: context,
    finalToolState: toolStateFromContext(context),
    seededNeedSummary:
      context.flow === "contact"
        ? (context as AnyConversationContext & { shortNeedSummary?: string }).shortNeedSummary
        : undefined,
  });

  if (scenario.expectations.shouldIncludeCalendarLink) {
    const combined = transcript.map((t) => t.agent).join("\n");
    if (!combined.includes("calendar.app.google/eval-test")) {
      score.technicalPass = false;
      score.failed = true;
      score.notes.push("Expected calendar link fallback but link not present");
    }
  }

  if (scenario.expectations.mustAcknowledgeFeedback) {
    const combined = transcript.map((t) => t.agent).join("\n").toLowerCase();
    if (!/\b(got it|understand|fair|helpful|feedback|custom|demo|jessica|configured)\b/.test(combined)) {
      score.overall = Math.min(score.overall, 0.7);
      score.weak = true;
      score.notes.push("May not have acknowledged demo feedback clearly");
    }
  }

  return { transcript, finalContext: context, score };
}

describe("Speed2Lead live model eval", () => {
  if (!LIVE_EVAL_ENABLED) {
    test.skip("Set S2L_LIVE_EVAL=true to run live OpenAI eval", () => {});
    return;
  }

  beforeAll(() => {
    assertEvalHarnessSafe();
  });

  test(
    "runs full real-model scenario suite and writes report",
    async () => {
      const safety = buildEnvironmentSafetyReport();
      expect(safety.harnessTouchesProductionRedis).toBe(false);

      const results: Array<{
        scenario: LiveEvalScenario;
        score: ScenarioScore;
        transcript: TranscriptTurn[];
      }> = [];

      for (const scenario of LIVE_EVAL_SCENARIOS) {
        bookingCalls = 0;
        const run = await runScenario(scenario);
        results.push({ scenario, score: run.score, transcript: run.transcript });
      }

      const byCategory = (cat: LiveEvalScenario["category"]) =>
        results.filter((r) => r.scenario.category === cat);

      const report = {
        model: getSpeed2LeadLlmModel(),
        previewUrl: safety.previewUrl,
        scenariosRun: results.length,
        overallScore: categoryAverage(results.map((r) => r.score)),
        categoryScores: {
          roi: categoryAverage(byCategory("roi").map((r) => r.score)),
          contact: categoryAverage(byCategory("contact").map((r) => r.score)),
          demo: categoryAverage(byCategory("demo").map((r) => r.score)),
          scheduling: categoryAverage(byCategory("scheduling").map((r) => r.score)),
          edge: categoryAverage(byCategory("edge").map((r) => r.score)),
        },
        passed: results
          .filter((r) => !r.score.failed && !r.score.weak && r.score.conversationalPass)
          .map((r) => r.scenario.id),
        weak: results.filter((r) => r.score.weak && !r.score.failed).map((r) => r.scenario.id),
        failed: results.filter((r) => r.score.failed).map((r) => r.scenario.id),
        technicalFailures: results
          .filter((r) => !r.score.technicalPass)
          .map((r) => ({ id: r.scenario.id, notes: r.score.notes })),
        unsupportedClaims: results.flatMap((r) =>
          r.score.unsupportedClaims.map((c) => ({ scenario: r.scenario.id, claim: c })),
        ),
        transcripts: results.map((r) => ({
          id: r.scenario.id,
          category: r.scenario.category,
          score: r.score.overall,
          failed: r.score.failed,
          weak: r.score.weak,
          transcript: r.transcript,
          notes: r.score.notes,
        })),
        touchedProduction: { redis: false, twilio: false, calendar: false },
        totalMockBookings: bookingCalls,
        safety,
      };

      await Bun.write("/tmp/s2l-live-eval-report.json", JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));

      expect(results.length).toBe(LIVE_EVAL_SCENARIOS.length);
    },
    900000,
  );
});
