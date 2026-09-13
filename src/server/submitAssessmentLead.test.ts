import { afterEach, describe, expect, mock, test } from "bun:test";

const baseRequest = {
  trade: "Plumbers" as const,
  truckCount: 10,
  monthlyCalls: 600,
  lead: {
    firstName: "Alex",
    lastName: "Rivera",
    businessName: "Rivera Plumbing",
    email: `assessment-${Date.now()}@example.com`,
    phone: "(555) 555-0101",
  },
  websiteOption: "none" as const,
  smsConsent: true,
};

describe("submitAssessmentLead pipeline", () => {
  afterEach(() => {
    mock.restore();
  });

  test("L30: handler returns report token and snapshot on success", async () => {
    mock.module("~/server/leads", () => ({
      saveLead: mock(async () => undefined),
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
        `https://624voice.com/assessment/report/${token}`,
    }));

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: mock(async () => undefined),
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
    );

    const result = await submitAssessmentLeadHandler({
      ...baseRequest,
      lead: {
        ...baseRequest.lead,
        email: `assessment-l30-${Date.now()}@example.com`,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.reportToken).toBe("assessment-token-abc");
    expect(result.reportUrl).toContain("/assessment/report/");
    expect(result.snapshot.trade).toBe("Plumbers");
    expect(result.replaySubstate).toBe("fresh");
  });

  test("L31: does not invoke S2L agent when ASSESSMENT_ROI_AGENT_LIVE_ENABLED is false", async () => {
    const startAgent = mock(async () => undefined);

    mock.module("~/server/leads", () => ({
      saveLead: mock(async () => undefined),
    }));

    mock.module("~/server/assessment/getTrustedClientIp", () => ({
      getTrustedClientIp: () => "203.0.113.11",
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
      createAssessmentReportToken: mock(async () => "token-l31"),
      buildAssessmentReportUrl: (token: string) =>
        `https://624voice.com/assessment/report/${token}`,
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
      lead: {
        ...baseRequest.lead,
        email: `assessment-l31-${Date.now()}@example.com`,
      },
      smsConsent: true,
    });

    expect(startAgent).not.toHaveBeenCalled();
  });

  test("L32: startAssessmentRoiAgent delegates to mocked S2L agent", async () => {
    const startAgent = mock(async () => undefined);

    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { startAssessmentRoiAgent } = await import("~/server/submitAssessmentLead");

    await startAssessmentRoiAgent({
      phone: "+15551234567",
      firstName: "Alex",
      lastName: "Rivera",
      businessName: "Rivera Plumbing",
      email: "alex@example.com",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed-Call Recovery",
      reportUrl: "https://624voice.com/assessment/report/token",
    });

    expect(startAgent).toHaveBeenCalledTimes(1);
    expect(startAgent.mock.calls[0]?.[0]?.reportUrl).toContain("/assessment/report/");
  });

  test("L33: SMS failure does not block assessment response", async () => {
    mock.module("~/config/features", () => ({
      FEATURE_FLAGS: {
        ASSESSMENT_ENABLED: true,
        ASSESSMENT_RATE_LIMIT_ENABLED: true,
        ASSESSMENT_REPORT_TOKENS_ENABLED: true,
        ASSESSMENT_ANALYTICS_ENABLED: true,
        ASSESSMENT_SMS_PIPELINE_ENABLED: true,
      },
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: true,
    }));

    mock.module("~/server/leads", () => ({
      saveLead: mock(async () => undefined),
    }));

    mock.module("~/server/assessment/getTrustedClientIp", () => ({
      getTrustedClientIp: () => "203.0.113.12",
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
      createAssessmentReportToken: mock(async () => "token-l33"),
      buildAssessmentReportUrl: (token: string) =>
        `https://624voice.com/assessment/report/${token}`,
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
      lead: {
        ...baseRequest.lead,
        email: `assessment-l33-${Date.now()}@example.com`,
      },
      smsConsent: true,
    });

    expect(result.ok).toBe(true);
    expect(result.reportToken).toBe("token-l33");
  });

  test("rejects when source rate limit exceeded", async () => {
    mock.module("~/server/assessment/getTrustedClientIp", () => ({
      getTrustedClientIp: () => "203.0.113.13",
    }));

    mock.module("~/server/assessment/rateLimitSource", () => ({
      checkAssessmentSourceRateLimit: mock(async () => ({
        allowed: false,
        count: 30,
        status: "limited",
      })),
      checkAssessmentPhoneIdempotency: mock(async () => ({
        case: "c",
        substate: "replay_conflict",
        allowed: false,
        count: 5,
      })),
      buildAssessmentPayloadHash: (payload: string) => `hash:${payload.length}`,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead"
    );

    await expect(
      submitAssessmentLeadHandler({
        ...baseRequest,
        lead: {
          ...baseRequest.lead,
          email: `assessment-rate-${Date.now()}@example.com`,
        },
      }),
    ).rejects.toThrow("Too many assessment requests");
  });
});
