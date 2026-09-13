import { afterEach, describe, expect, test } from "bun:test";

const ENV_KEY = "ASSESSMENT_SECURITY_HMAC_SECRET";

describe("assessmentSecurity supplemental", () => {
  const originalSecret = process.env[ENV_KEY];

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalSecret;
    }
  });

  test("S-SEC-01: returns null when secret env var is missing", async () => {
    delete process.env[ENV_KEY];

    const { getAssessmentSecurityHmacSecret } = await import(
      "~/server/assessment/assessmentSecurity.server"
    );

    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-SEC-02: returns null when secret is shorter than 32 chars", async () => {
    process.env[ENV_KEY] = "short-secret";

    const { getAssessmentSecurityHmacSecret } = await import(
      "~/server/assessment/assessmentSecurity.server"
    );

    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-SEC-03: returns trimmed secret when configured", async () => {
    process.env[ENV_KEY] = `  ${"b".repeat(40)}  `;

    const { getAssessmentSecurityHmacSecret } = await import(
      "~/server/assessment/assessmentSecurity.server"
    );

    expect(getAssessmentSecurityHmacSecret()).toBe("b".repeat(40));
  });

  test("S-SEC-04: isAssessmentSecurityConfigured fails closed without secret", async () => {
    delete process.env[ENV_KEY];

    const { isAssessmentSecurityConfigured } = await import(
      "~/server/assessment/assessmentSecurity.server"
    );

    expect(isAssessmentSecurityConfigured()).toBe(false);
  });
});
