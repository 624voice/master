/**
 * Proves stale GF-F1/F2/F3 absent through the real production submission path.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AssessmentEngine } from "../../src/lib/assessment/engine";
import { buildAnswersPayload } from "../../src/lib/assessment/buildAnswersPayload";
import { buildAssessmentReportViewModel } from "../../src/lib/assessment/buildAssessmentReportViewModel";
import {
  ANALYTICS_EVENTS,
  setAnalyticsSink,
  trackEvent,
} from "../../src/lib/analytics/trackEvent";
import type { AssessmentReportSnapshot } from "../../src/server/assessment/types";

const STALE_KEYS = ["GF-F1", "GF-F2", "GF-F3"] as const;

function assertNoStaleKeys(serialized: string, label: string): void {
  for (const key of STALE_KEYS) {
    expect(serialized.includes(key)).toBe(false);
  }
  expect(serialized).not.toContain("GF-F1");
  expect(serialized).not.toContain("GF-F2");
  expect(serialized).not.toContain("GF-F3");
  void label;
}

function buildStaleEngine(): AssessmentEngine {
  const engine = new AssessmentEngine();
  engine.onScreeningAnswered("GF", 3);
  engine.setAnswer("GF-F1", 2);
  engine.setAnswer("GF-F2", 1);
  engine.setAnswer("GF-F3", 0);
  engine.setAnswer("CV-S", 0);
  engine.setAnswer("RG-S", 0);
  engine.setAnswer("RM-S", 0);
  engine.setAnswer("MI-S", 0);
  engine.onScreeningChanged("GF", 0);
  return engine;
}

describe("assessment stale submission serialization", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.ASSESSMENT_SECURITY_HMAC_SECRET = process.env.ASSESSMENT_SECURITY_HMAC_SECRET;
    savedEnv.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
    savedEnv.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.ASSESSMENT_SECURITY_HMAC_SECRET = "a".repeat(64);
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    mock.restore();
    setAnalyticsSink(null);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("X-SAFE-PREVIEW-FOCUS-06: production path excludes GF-F1/F2/F3 after GF-S lowered", async () => {
    const engine = buildStaleEngine();
    const answers = buildAnswersPayload("HVAC", "3-7", { monthlyCalls: 450 }, engine);
    const answersJson = JSON.stringify(answers);

    expect(answers).not.toHaveProperty("GF-F1");
    expect(answers).not.toHaveProperty("GF-F2");
    expect(answers).not.toHaveProperty("GF-F3");
    assertNoStaleKeys(answersJson, "production serializer");

    const saveLead = mock(async () => undefined);
    let capturedSnapshot: AssessmentReportSnapshot | null = null;
    const createAssessmentReportToken = mock(async (input: { snapshot: AssessmentReportSnapshot }) => {
      capturedSnapshot = input.snapshot;
      return "phase2-stale-proof-token";
    });
    const startAgentConversation = mock(async () => undefined);

    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP: () => "127.0.0.1",
    }));
    mock.module("~/server/speed2Lead/redis", () => ({
      getRedis: () => ({
        eval: mock(async (_s: string, _k: string[], args: string[]) =>
          args.length <= 5 ? [1, 1, "allowed"] : ["a", "fresh", 1, 1, null],
        ),
        get: mock(),
        set: mock(),
      }),
    }));
    mock.module("~/server/assessment/reportTokens", () => ({
      createAssessmentReportToken,
      buildAssessmentReportUrl: (token: string) =>
        `http://127.0.0.1:3000/assessment-report/${token}`,
    }));
    mock.module("~/server/leads", () => ({ saveLead }));
    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {},
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: false,
    }));
    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation,
    }));

    const analyticsEvents: Array<{ name: string; props: Record<string, unknown> }> = [];
    setAnalyticsSink((name, props) => {
      analyticsEvents.push({ name, props: props ?? {} });
      assertNoStaleKeys(JSON.stringify(props ?? {}), `analytics:${name}`);
    });

    const { submitAssessmentLeadHandler } = await import(
      "../../src/server/submitAssessmentLead.server"
    );

    const result = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Alex",
        lastName: "Testowner",
        businessName: "Owner QA Fake HVAC Co",
        email: "owner-qa-fake@example.com",
        phone: "5550100199",
      },
      smsConsent: false,
      idempotencyKey: `phase2-stale-${Date.now()}`,
      answers,
    });

    expect(result.ok).toBe(true);
    assertNoStaleKeys(JSON.stringify(answers), "handler input answers");
    expect(startAgentConversation).not.toHaveBeenCalled();

    expect(saveLead).toHaveBeenCalledTimes(1);
    const leadArg = saveLead.mock.calls[0]?.[0] as { message?: string } | undefined;
    expect(leadArg?.message).toBeTruthy();
    assertNoStaleKeys(JSON.stringify(leadArg ?? {}), "fake lead sink");

    expect(createAssessmentReportToken).toHaveBeenCalledTimes(1);
    expect(capturedSnapshot).toBeTruthy();
    assertNoStaleKeys(JSON.stringify(capturedSnapshot), "persistence/report-token snapshot");

    const vm = buildAssessmentReportViewModel(result.results);
    assertNoStaleKeys(JSON.stringify(vm), "report view model");

    expect(analyticsEvents.some((e) => e.name === ANALYTICS_EVENTS.assessment_complete)).toBe(
      true,
    );
    trackEvent(ANALYTICS_EVENTS.assessment_complete, { hasEstimate: "true" });
  });
});
