import { afterEach, describe, expect, test } from "bun:test";
import {
  getAssessmentSecurityHmacSecret,
  isAssessmentSecurityConfigured,
} from "~/server/assessment/assessmentSecurity.server";

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

  test("S-SEC-01: returns null when secret env var is missing", () => {
    delete process.env[ENV_KEY];
    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-SEC-02: returns null when secret is shorter than 32 chars", () => {
    process.env[ENV_KEY] = "short-secret";
    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-SEC-03: returns trimmed secret when configured", () => {
    process.env[ENV_KEY] = `  ${"b".repeat(40)}  `;
    expect(getAssessmentSecurityHmacSecret()).toBe("b".repeat(40));
  });

  test("S-SEC-04: isAssessmentSecurityConfigured fails closed without secret", () => {
    delete process.env[ENV_KEY];
    expect(isAssessmentSecurityConfigured()).toBe(false);
  });
});
