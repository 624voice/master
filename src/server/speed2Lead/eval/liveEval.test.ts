import { describe, expect, test, mock, beforeAll } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  assertEvalHarnessSafe,
  buildEnvironmentSafetyReport,
} from "~/server/speed2Lead/eval/environmentSafety";
import { observeAuthoritativeSchedulingState } from "~/server/speed2Lead/eval/authoritativeState";
import { LIVE_EVAL_SCENARIOS, type LiveEvalScenario } from "~/server/speed2Lead/eval/scenarios";
import {
  categoryAverage,
  scoreScenario,
  type EvalFailureClass,
  type ScenarioScore,
  type TranscriptTurn,
} from "~/server/speed2Lead/eval/scoring";
import {
  applyDisposition,
  appendAssistantMessage,
  appendUserMessage,
} from "~/server/speed2Lead/memory";
import { resolveDispositionAfterInbound } from "~/server/speed2Lead/conversationDisposition";
import { getSpeed2LeadLlmModel } from "~/server/speed2Lead/config";
import {
  planSchedulingGate,
} from "~/server/speed2Lead/schedulingController";
import { summarizeGateAction } from "~/server/speed2Lead/testObservability";
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

type TurnDiagnostic = {
  customer: string;
  disposition?: string;
  gateAction: string;
  schedulingIntent: boolean;
  authoritativeSlots: number;
  bookingConfirmed: boolean;
  schedulingStatus?: string;
  availabilityAttempts: number;
  agentPreview: string;
};

async function runScenario(scenario: LiveEvalScenario): Promise<{
  transcript: TranscriptTurn[];
  finalContext: AnyConversationContext;
  score: ScenarioScore;
  diagnostics: TurnDiagnostic[];
}> {
  consultationSlots = scenario.presetSlots?.(EVAL_NOW) ?? [];
  availabilityMode = scenario.calendarMode === "unconfigured" ? "unconfigured" : "ok";
  bookingShouldFail = scenario.calendarMode === "slot_conflict";

  let context = scenario.buildSession(EVAL_NOW);
  if (scenario.openingMessage) {
    context = appendAssistantMessage(context, scenario.openingMessage(context));
  }

  const transcript: TranscriptTurn[] = [];
  const toolStatesByTurn: ReturnType<typeof observeAuthoritativeSchedulingState>[] = [];
  const diagnostics: TurnDiagnostic[] = [];

  for (const customerTurn of scenario.customerTurns) {
    context = appendUserMessage(context, customerTurn);
    context = applyDisposition(context, resolveDispositionAfterInbound(context, customerTurn));

    const gatePlan = planSchedulingGate({
      inboundMessage: customerTurn,
      context,
      now: EVAL_NOW,
    });

    const result = await orchestrateInboundTurn(context, customerTurn, { now: EVAL_NOW });

    if (!result.handled) {
      if ("context" in result && result.context) {
        context = result.context;
      }
      const recoveryReply =
        "recoveryReply" in result && result.recoveryReply ? result.recoveryReply : null;
      if (recoveryReply) {
        context = appendAssistantMessage(context, recoveryReply);
        const observed = observeAuthoritativeSchedulingState(context);
        toolStatesByTurn.push(observed);
        diagnostics.push({
          customer: customerTurn,
          disposition: context.disposition,
          gateAction: summarizeGateAction(gatePlan),
          schedulingIntent: gatePlan.schedulingIntent,
          authoritativeSlots: observed.offeredSlots.length,
          bookingConfirmed: observed.bookingConfirmed,
          schedulingStatus: context.scheduling?.status,
          availabilityAttempts: context.scheduling?.availabilityAttempts ?? 0,
          agentPreview: recoveryReply.slice(0, 120),
        });
        transcript.push({
          customer: customerTurn,
          agent: recoveryReply,
          handled: true,
        });
        continue;
      }
      transcript.push({
        customer: customerTurn,
        agent: `[FALLBACK:${result.reason}]`,
        handled: false,
        fallbackReason: result.reason,
      });
      diagnostics.push({
        customer: customerTurn,
        disposition: context.disposition,
        gateAction: summarizeGateAction(gatePlan),
        schedulingIntent: gatePlan.schedulingIntent,
        authoritativeSlots: 0,
        bookingConfirmed: false,
        schedulingStatus: context.scheduling?.status,
        availabilityAttempts: context.scheduling?.availabilityAttempts ?? 0,
        agentPreview: `[FALLBACK:${result.reason}]`,
      });
      break;
    }

    context = result.context;
    context = appendAssistantMessage(context, result.reply);
    const observed = observeAuthoritativeSchedulingState(context);
    toolStatesByTurn.push(observed);
    diagnostics.push({
      customer: customerTurn,
      disposition: context.disposition,
      gateAction: summarizeGateAction(gatePlan),
      schedulingIntent: gatePlan.schedulingIntent,
      authoritativeSlots: observed.offeredSlots.length,
      bookingConfirmed: observed.bookingConfirmed,
      schedulingStatus: context.scheduling?.status,
      availabilityAttempts: context.scheduling?.availabilityAttempts ?? 0,
      agentPreview: result.reply.slice(0, 120),
    });
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
    finalToolState: observeAuthoritativeSchedulingState(context),
    toolStatesByTurn,
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
      score.failureClass = "deterministic_orchestration";
      score.notes.push("Expected calendar link fallback but link not present");
    }
  }

  if (scenario.expectations.mustAcknowledgeFeedback) {
    const combined = transcript.map((t) => t.agent).join("\n").toLowerCase();
    if (!/\b(got it|understand|fair|helpful|feedback|custom|demo|jessica|configured)\b/.test(combined)) {
      score.overall = Math.min(score.overall, 0.7);
      score.weak = true;
      score.failureClass = score.failureClass ?? "model_judgment";
      score.notes.push("May not have acknowledged demo feedback clearly");
    }
  }

  return { transcript, finalContext: context, score, diagnostics };
}

function isCustomerFacingFailure(score: ScenarioScore): boolean {
  return (
    score.failureClass === "deterministic_orchestration" ||
    (score.failed && score.failureClass !== "model_judgment" && score.unsupportedClaims.length > 0)
  );
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
        diagnostics: TurnDiagnostic[];
      }> = [];

      for (const scenario of LIVE_EVAL_SCENARIOS) {
        bookingCalls = 0;
        const run = await runScenario(scenario);
        results.push({
          scenario,
          score: run.score,
          transcript: run.transcript,
          diagnostics: run.diagnostics,
        });
      }

      const byCategory = (cat: LiveEvalScenario["category"]) =>
        results.filter((r) => r.scenario.category === cat);

      const failureClassCounts = results.reduce(
        (acc, r) => {
          if (r.score.failed && r.score.failureClass) {
            acc[r.score.failureClass] = (acc[r.score.failureClass] ?? 0) + 1;
          }
          return acc;
        },
        {} as Partial<Record<EvalFailureClass, number>>,
      );

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
        customerFacingFailures: results
          .filter((r) => r.score.failed && isCustomerFacingFailure(r.score))
          .map((r) => ({
            id: r.scenario.id,
            failureClass: r.score.failureClass,
            notes: r.score.notes,
          })),
        failureClassCounts,
        technicalFailures: results
          .filter((r) => !r.score.technicalPass)
          .map((r) => ({
            id: r.scenario.id,
            failureClass: r.score.failureClass,
            notes: r.score.notes,
          })),
        unsupportedClaims: results.flatMap((r) =>
          r.score.unsupportedClaims.map((c) => ({ scenario: r.scenario.id, claim: c })),
        ),
        transcripts: results.map((r) => ({
          id: r.scenario.id,
          category: r.scenario.category,
          score: r.score.overall,
          failed: r.score.failed,
          weak: r.score.weak,
          failureClass: r.score.failureClass,
          customerFacing: r.score.failed ? isCustomerFacingFailure(r.score) : false,
          transcript: r.transcript,
          notes: r.score.notes,
          diagnostics: r.diagnostics,
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
