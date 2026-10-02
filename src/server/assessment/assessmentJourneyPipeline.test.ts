import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { validateLeadInfo } from "~/lib/lead/validateLead";
import {
  ANALYTICS_EVENTS,
  setAnalyticsSink,
} from "~/lib/analytics/trackEvent";
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

function mockPipeline(options?: {
  tokenData?: unknown;
  pdfThrows?: boolean;
}) {
  const tokenStore = new Map<string, unknown>();
  const evalMock = mock(async (_script: string, _keys: string[], args: string[]) => {
    if (args.length <= 5) return [1, 1, "allowed"];
    return ["a", "fresh", 1, 1, null];
  });

  mock.module("@tanstack/react-start/server", () => ({
    getRequestIP: () => "203.0.113.10",
  }));

  mock.module("~/server/speed2Lead/redis", () => ({
    getRedis: () => ({
      eval: evalMock,
      get: mock(async (key: string) => tokenStore.get(key) ?? null),
      set: mock(async (key: string, value: unknown) => {
        tokenStore.set(key, value);
      }),
    }),
  }));

  mock.module("~/server/assessment/reportTokens", () => ({
    createAssessmentReportToken: mock(async (data: unknown) => {
      const token = "abc123def456789012345678901234567890123456789012";
      tokenStore.set(`assessment:report:${token}`, data);
      return token;
    }),
    buildAssessmentReportUrl: (token: string) =>
      `https://624voice.com/assessment-report/${token}`,
    getAssessmentReportTokenData: mock(async (token: string) => {
      if (options?.tokenData === "expired") return null;
      return tokenStore.get(`assessment:report:${token}`) ?? null;
    }),
  }));

  mock.module("~/server/leads", () => ({
    saveLead: mock(async () => undefined),
  }));

  if (options?.pdfThrows) {
    mock.module("~/server/report/generateAssessmentPdfBytes.server", () => ({
      generateAssessmentPdfBytes: mock(async () => {
        throw new Error("pdf renderer unavailable");
      }),
    }));
  }

  return { tokenStore, evalMock };
}

describe("Assessment journey pipeline X-JRN-PIPE", () => {
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
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("X-JRN-PIPE-01: lead-gate validation errors surface required fields", () => {
    expect(validateLeadInfo({
      firstName: "",
      lastName: "Lee",
      businessName: "Biz",
      email: "bad",
      phone: "123",
    })).toBe("First name is required.");

    expect(validateLeadInfo({
      firstName: "Pat",
      lastName: "Lee",
      businessName: "Biz",
      email: "not-an-email",
      phone: "5555550101",
    })).toBe("Enter a valid email address.");
  });

  test("X-JRN-PIPE-02: corrected resubmission after validation failure succeeds", async () => {
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
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: false,
    }));
    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: mock(async () => undefined),
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await expect(
      submitAssessmentLeadHandler({
        lead: {
          firstName: "",
          lastName: "Lee",
          businessName: "Biz",
          email: "pat@example.com",
          phone: "5555550101",
        },
        smsConsent: false,
        idempotencyKey: `idem-${Date.now()}`,
        answers: baseAnswers,
      }),
    ).rejects.toThrow(/First name is required/i);

    const result = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        businessName: "Biz",
        email: `pipe-${Date.now()}@example.com`,
        phone: "5555550101",
      },
      smsConsent: false,
      idempotencyKey: `idem-${Date.now()}`,
      answers: baseAnswers,
    });

    expect(result.ok).toBe(true);
    expect(result.reportUrl).toContain("/assessment-report/");
  });

  test("X-JRN-PIPE-03: results and PDF access with SMS consent unchecked", async () => {
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

    const analyticsEvents: string[] = [];
    setAnalyticsSink((name) => {
      analyticsEvents.push(name);
    });

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    const result = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        businessName: "Biz",
        email: `noconsent-${Date.now()}@example.com`,
        phone: "5555550102",
      },
      smsConsent: false,
      idempotencyKey: `idem-${Date.now()}`,
      answers: baseAnswers,
    });

    expect(result.ok).toBe(true);
    expect(result.reportToken).toBeTruthy();
    expect(startAgent).not.toHaveBeenCalled();
    expect(analyticsEvents).toContain(ANALYTICS_EVENTS.lead_gate_complete);
    expect(analyticsEvents).not.toContain(ANALYTICS_EVENTS.sms_consent_opt_in);
    expect(analyticsEvents).not.toContain(ANALYTICS_EVENTS.roi_agent_triggered);
  });

  test("X-JRN-PIPE-04: consent checked but agent flag false still returns report", async () => {
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
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: false,
    }));
    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: startAgent,
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    const result = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        businessName: "Biz",
        email: `flagoff-${Date.now()}@example.com`,
        phone: "5555550103",
      },
      smsConsent: true,
      idempotencyKey: `idem-${Date.now()}`,
      answers: baseAnswers,
    });

    expect(result.ok).toBe(true);
    expect(result.reportUrl).toContain("/assessment-report/");
    expect(startAgent).not.toHaveBeenCalled();
  });

  test("X-JRN-PIPE-05: repeat report access under approved token contract", async () => {
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
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: false,
    }));
    mock.module("~/server/speed2Lead/agent/startConversation", () => ({
      startAgentConversation: mock(async () => undefined),
    }));

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );
    const { serveAssessmentTokenPdf } = await import(
      "~/server/report/serveAssessmentTokenPdf.server"
    );

    const submit = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        businessName: "Biz",
        email: `repeat-${Date.now()}@example.com`,
        phone: "5555550104",
      },
      smsConsent: false,
      idempotencyKey: `idem-${Date.now()}`,
      answers: baseAnswers,
    });

    const token = submit.reportToken!;
    const first = await serveAssessmentTokenPdf(token);
    const second = await serveAssessmentTokenPdf(token);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get("Content-Type")).toBe("application/pdf");
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("X-JRN-PIPE-06: invalid and expired report tokens return 404 plain text", async () => {
    mockPipeline({ tokenData: "expired" });
    const { serveAssessmentTokenPdf } = await import(
      "~/server/report/serveAssessmentTokenPdf.server"
    );

    const invalid = await serveAssessmentTokenPdf("not-a-valid-token");
    expect(invalid.status).toBe(404);
    expect(await invalid.text()).toContain("expired or is invalid");
  });

  test("X-JRN-PIPE-07: retryable report failure exposes visitor recovery message", async () => {
    mockPipeline({ pdfThrows: true });
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
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: false,
    }));

    const { serveAssessmentTokenPdf } = await import(
      "~/server/report/serveAssessmentTokenPdf.server"
    );
    const { createAssessmentReportToken } = await import(
      "~/server/assessment/reportTokens"
    );
    const { runAssessment } = await import("~/lib/assessment/runAssessment");

    const snapshot = {
      ...runAssessment(baseAnswers),
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        businessName: "Biz",
        email: "pat@example.com",
        phone: "5555550105",
      },
      reportGeneratedAt: new Date().toISOString(),
    };
    const token = await createAssessmentReportToken({ snapshot });

    await expect(serveAssessmentTokenPdf(token)).rejects.toThrow(
      /pdf renderer unavailable/i,
    );

    const recoveryMessage =
      "Could not submit your assessment. Please try again.";
    expect(recoveryMessage).toContain("try again");
  });
});
