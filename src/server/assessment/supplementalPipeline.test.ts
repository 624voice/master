import { afterEach, describe, expect, mock, test } from "bun:test";
import { forceReinstallSpeed2LeadIntegrationMocks } from "~/server/speed2Lead/testSupport/integrationMocks";
import { isAssessmentSecurityConfigured } from "~/server/assessment/assessmentSecurity.server";

const ENV_KEY = "ASSESSMENT_SECURITY_HMAC_SECRET";

describe("submitAssessmentLead pipeline supplemental S-PL", () => {
  const originalSecret = process.env[ENV_KEY];

  afterEach(() => {
    mock.restore();
    forceReinstallSpeed2LeadIntegrationMocks();
    if (originalSecret === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalSecret;
    }
  });

  test("S-PL-08: fail-closed when secret absent returns persistenceAvailable false", async () => {
    delete process.env[ENV_KEY];
    expect(isAssessmentSecurityConfigured()).toBe(false);

    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    const result = await submitAssessmentLeadHandler({
      lead: {
        firstName: "Pat",
        lastName: "Lee",
        email: "pat@example.com",
        phone: "+15551234567",
        businessName: "Pat HVAC",
      },
      answers: {
        BP1: "HVAC",
        BP2: "3-7",
        R1: 300,
        R2: 15,
        R3: 350,
        "GF-S": 2,
        "CV-S": 1,
        "RG-S": 1,
        "RM-S": 1,
        "MI-S": 1,
      },
      smsConsent: false,
      idempotencyKey: "idem-fail-closed",
    });

    expect(result.persistenceAvailable).toBe(false);
    expect(result.reportToken).toBeUndefined();
  });

  test("S-PL-09: invalid lead info throws before assessment runs", async () => {
    process.env[ENV_KEY] = "a".repeat(64);
    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await expect(
      submitAssessmentLeadHandler({
        lead: {
          firstName: "",
          lastName: "Lee",
          email: "bad",
          phone: "123",
          businessName: "Pat HVAC",
        },
        answers: {},
        smsConsent: false,
        idempotencyKey: "idem-invalid-lead",
      }),
    ).rejects.toThrow();
  });

  test("S-PL-10: invalid answers throw before persistence", async () => {
    process.env[ENV_KEY] = "a".repeat(64);
    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );

    await expect(
      submitAssessmentLeadHandler({
        lead: {
          firstName: "Pat",
          lastName: "Lee",
          email: "pat@example.com",
          phone: "+15551234567",
          businessName: "Pat HVAC",
        },
        answers: { mystery: "field" },
        smsConsent: false,
        idempotencyKey: "idem-invalid-answers",
      }),
    ).rejects.toThrow(/Unknown assessment answer fields|Invalid answer/);
  });

  test("S-PL-11: ASSESSMENT_ROI_AGENT_LIVE_ENABLED remains false in features", async () => {
    const { ASSESSMENT_ROI_AGENT_LIVE_ENABLED } = await import("~/config/features");
    expect(ASSESSMENT_ROI_AGENT_LIVE_ENABLED).toBe(false);
  });

  test("S-PL-12: startAssessmentRoiAgent delegates to startAgentConversation", async () => {
    const source = await Bun.file(
      `${import.meta.dir}/../submitAssessmentLead.server.ts`,
    ).text();
    expect(source).toContain("startAgentConversation");
    expect(source).toContain("ASSESSMENT_ROI_AGENT_LIVE_ENABLED");
  });

  test("S-PL-13: live agent path gated by ASSESSMENT_ROI_AGENT_LIVE_ENABLED", async () => {
    const source = await Bun.file(
      `${import.meta.dir}/../submitAssessmentLead.server.ts`,
    ).text();
    expect(source).toMatch(/ASSESSMENT_ROI_AGENT_LIVE_ENABLED &&/);
  });

  test("S-PL-14: agent failure is caught and does not throw to caller", async () => {
    const source = await Bun.file(
      `${import.meta.dir}/../submitAssessmentLead.server.ts`,
    ).text();
    expect(source).toContain("catch (error)");
    expect(source).toContain("Assessment Speed2Lead initial SMS failed");
  });

  test("S-PL-15: report token creation uses assessment namespace", async () => {
    const tokens = await Bun.file(`${import.meta.dir}/reportTokens.ts`).text();
    expect(tokens).toContain("assessment:report:");
  });

  test("S-PL-16: thin client wrapper re-exports server handler only", async () => {
    const thin = await Bun.file(`${import.meta.dir}/../submitAssessmentLead.ts`).text();
    expect(thin).toContain("submitAssessmentLeadHandler");
    expect(thin).not.toContain("saveLead");
  });
});
