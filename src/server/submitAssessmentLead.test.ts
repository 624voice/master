import { afterEach, describe, expect, mock, test } from "bun:test";

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
  mock.module("~/server/assessment/assessmentSecurity.server", () => ({
    isAssessmentSecurityConfigured: () => true,
    getAssessmentSecurityHmacSecret: () => "a".repeat(64),
  }));

  mock.module("~/server/assessment/getTrustedClientIp", () => ({
    getTrustedClientIp: () => "203.0.113.10",
  }));

  mock.module("~/server/assessment/rateLimitSource", () => ({
    checkAssessmentSourceRateLimit: mock(async () => ({
      allowed: true,
      count: 1,
      status: "allowed",
    })),
    checkAssessmentPhoneIdempotency: mock(async () => ({
      case: "a",
      substate: "fresh",
      allowed: true,
      count: 1,
    })),
    buildAssessmentPayloadHash: (payload: string) => `hash:${payload.length}`,
  }));

  mock.module("~/server/assessment/reportTokens", () => ({
    createAssessmentReportToken: mock(async () => "assessment-token-abc"),
    buildAssessmentReportUrl: (token: string) =>
      `https://624voice.com/assessment-report/${token}`,
  }));

  mock.module("~/server/leads", () => ({
    saveLead: mock(async () => undefined),
  }));
}

describe("submitAssessmentLead pipeline", () => {
  afterEach(() => {
    mock.restore();
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

    mock.module("~/server/speed2Lead/config", () => ({
      isSpeed2LeadEnabled: () => true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
    );

    await submitAssessmentLeadHandler({
      ...baseRequest,
      lead: { ...baseRequest.lead, email: `l30-${Date.now()}@example.com` },
    });

    expect(startAgent).toHaveBeenCalledTimes(1);
    const payload = startAgent.mock.calls[0]?.[0] as {
      annualOpportunity: string;
    };
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

    mock.module("~/server/speed2Lead/config", () => ({
      isSpeed2LeadEnabled: () => true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
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

    mock.module("~/server/speed2Lead/config", () => ({
      isSpeed2LeadEnabled: () => true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: mock(async () => {
        throw new Error("twilio down");
      }),
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
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

    mock.module("~/server/speed2Lead/config", () => ({
      isSpeed2LeadEnabled: () => true,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
    );

    await submitAssessmentLeadHandler({
      ...baseRequest,
      smsConsent: false,
      lead: { ...baseRequest.lead, email: `l33-${Date.now()}@example.com` },
    });

    expect(startAgent).not.toHaveBeenCalled();
  });
});
