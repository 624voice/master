import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { forceReinstallSpeed2LeadIntegrationMocks } from "~/server/speed2Lead/testSupport/integrationMocks";

const ENV_KEYS = [
  "ASSESSMENT_SECURITY_HMAC_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "SPEED2LEAD_ENABLED",
] as const;

const baseAnswers = {
  BP1: "Plumbers",
  BP2: "3-7",
  R1: 300,
  R2: 15,
  R3: 350,
  "GF-S": 2,
  "CV-S": 1,
  "RG-S": 1,
  "RM-S": 1,
  "MI-S": 1,
};

const baseRequest = {
  lead: {
    firstName: "Alex",
    lastName: "Rivera",
    businessName: "Rivera Plumbing",
    email: `assessment-${Date.now()}@example.com`,
    phone: "(555) 555-0101",
  },
  smsConsent: true,
  idempotencyKey: `idem-${Date.now()}`,
  answers: baseAnswers,
};

function mockPipeline() {
  const evalMock = mock(async (_script: string, _keys: string[], args: string[]) => {
    if (args.length <= 5) {
      return [1, 1, "allowed"];
    }
    return ["a", "fresh", 1, 1, null];
  });

  mock.module("@tanstack/react-start/server", () => ({
    getRequestIP: () => "203.0.113.10",
  }));

  mock.module("~/server/speed2Lead/redis", () => ({
    getRedis: () => ({ eval: evalMock, get: mock(), set: mock() }),
  }));

  mock.module("~/server/assessment/reportTokens", () => ({
    createAssessmentReportToken: mock(async () => "assessment-token-abc"),
    buildAssessmentReportUrl: (token: string) =>
      `https://624voice.com/assessment-report/${token}`,
  }));

  mock.module("~/server/leads", () => ({
    saveLead: mock(async () => undefined),
  }));

  return { evalMock };
}

describe("submitAssessmentLead pipeline", () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.ASSESSMENT_SECURITY_HMAC_SECRET = "a".repeat(64);
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-auth";
    process.env.TWILIO_FROM_NUMBER = "+15550001111";
    process.env.SPEED2LEAD_ENABLED = "true";
  });

  afterEach(() => {
    mock.restore();
    forceReinstallSpeed2LeadIntegrationMocks();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("L#30: invokes ROI agent with formatted annualOpportunity when eligible", async () => {
    const startAgent = mock(async () => undefined);
    mockPipeline();

    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {
        REQUIRE_LEAD_FOR_PDF: true,
        REQUIRE_LEAD_FOR_RESULTS: true,
        SHOW_DIAGNOSTIC_CREDIT_MENTION: false,
        SHOW_VOICE_AI_GUARANTEE: false,
        SHOW_PAYMENT_BALANCE_CARD: false,
        SHOW_FOOTER_CONTACT_DETAILS: false,
        SHOW_FOUNDER_PARAGRAPH_UPDATE: false,
      },
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await submitAssessmentLeadHandler({
      ...baseRequest,
      lead: { ...baseRequest.lead, email: `l30-${Date.now()}@example.com` },
    });

    expect(startAgent).toHaveBeenCalledTimes(1);
    const call = startAgent.mock.calls[0] as unknown as
      | [{ annualOpportunity: string }]
      | undefined;
    expect(call).toBeDefined();
    const payload = call![0];
    expect(payload.annualOpportunity).toMatch(/^\$/);
    expect(payload.annualOpportunity).not.toBe("not available");
  });

  test("L#31: skips agent when no usable dollar estimate", async () => {
    const startAgent = mock(async () => undefined);
    mockPipeline();

    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {
        REQUIRE_LEAD_FOR_PDF: true,
        REQUIRE_LEAD_FOR_RESULTS: true,
        SHOW_DIAGNOSTIC_CREDIT_MENTION: false,
        SHOW_VOICE_AI_GUARANTEE: false,
        SHOW_PAYMENT_BALANCE_CARD: false,
        SHOW_FOOTER_CONTACT_DETAILS: false,
        SHOW_FOUNDER_PARAGRAPH_UPDATE: false,
      },
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await submitAssessmentLeadHandler({
      ...baseRequest,
      answers: { ...baseAnswers, BP1: "InvalidTrade" },
      lead: { ...baseRequest.lead, email: `l31-${Date.now()}@example.com` },
    });

    expect(startAgent).not.toHaveBeenCalled();
  });

  test("L#32 A-RESILIENCE-01: agent throw does not block results or report", async () => {
    mockPipeline();

    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {
        REQUIRE_LEAD_FOR_PDF: true,
        REQUIRE_LEAD_FOR_RESULTS: true,
        SHOW_DIAGNOSTIC_CREDIT_MENTION: false,
        SHOW_VOICE_AI_GUARANTEE: false,
        SHOW_PAYMENT_BALANCE_CARD: false,
        SHOW_FOOTER_CONTACT_DETAILS: false,
        SHOW_FOUNDER_PARAGRAPH_UPDATE: false,
      },
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: mock(async () => {
        throw new Error("twilio down");
      }),
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    const result = await submitAssessmentLeadHandler({
      ...baseRequest,
      lead: { ...baseRequest.lead, email: `l32-${Date.now()}@example.com` },
      smsConsent: true,
    });

    expect(result.ok).toBe(true);
    expect(result.reportToken).toBe("assessment-token-abc");
    expect(result.reportUrl).toContain("/assessment-report/");
  });

  test("L#33: agent never invoked without SMS consent", async () => {
    const startAgent = mock(async () => undefined);
    mockPipeline();

    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {
        REQUIRE_LEAD_FOR_PDF: true,
        REQUIRE_LEAD_FOR_RESULTS: true,
        SHOW_DIAGNOSTIC_CREDIT_MENTION: false,
        SHOW_VOICE_AI_GUARANTEE: false,
        SHOW_PAYMENT_BALANCE_CARD: false,
        SHOW_FOOTER_CONTACT_DETAILS: false,
        SHOW_FOUNDER_PARAGRAPH_UPDATE: false,
      },
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await submitAssessmentLeadHandler({
      ...baseRequest,
      smsConsent: false,
      lead: { ...baseRequest.lead, email: `l33-${Date.now()}@example.com` },
    });

    expect(startAgent).not.toHaveBeenCalled();
  });
});
