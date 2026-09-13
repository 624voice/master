import { afterEach, describe, expect, test } from "bun:test";
import {
  getAssessmentSecurityHmacSecret,
  isAssessmentSecurityConfigured,
} from "~/server/assessment/assessmentSecurity.server";

const ENV_KEY = "ASSESSMENT_SECURITY_HMAC_SECRET";

describe("assessmentSecurity supplemental", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  test("S-PL-04: returns null when secret env var is missing", () => {
    delete process.env[ENV_KEY];
    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-PL-05: returns null when secret is shorter than 32 chars", () => {
    process.env[ENV_KEY] = "short";
    expect(getAssessmentSecurityHmacSecret()).toBeNull();
  });

  test("S-PL-06: returns trimmed secret when configured", () => {
    process.env[ENV_KEY] = `  ${"a".repeat(64)}  `;
    expect(getAssessmentSecurityHmacSecret()).toBe("a".repeat(64));
  });

  test("S-PL-07: isAssessmentSecurityConfigured fails closed without secret", () => {
    delete process.env[ENV_KEY];
    expect(isAssessmentSecurityConfigured()).toBe(false);
  });
});
