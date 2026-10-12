import { describe, expect, test } from "bun:test";
import {
  ASSESSMENT_PHONE_RATE_LIMIT,
  ASSESSMENT_PHONE_WINDOW_SECONDS,
  ASSESSMENT_RATE_LIMIT_KEY_PREFIX,
  ASSESSMENT_SOURCE_RATE_LIMIT,
  ASSESSMENT_SOURCE_WINDOW_SECONDS,
  RATE_LIMITS,
} from "~/config/rateLimits";

describe("rate limit config supplemental S-RATE", () => {
  test("S-RATE-01: source limit is 30 per hour", () => {
    expect(ASSESSMENT_SOURCE_RATE_LIMIT).toBe(30);
    expect(ASSESSMENT_SOURCE_WINDOW_SECONDS).toBe(3600);
  });

  test("S-RATE-02: phone limit is 5 per day", () => {
    expect(ASSESSMENT_PHONE_RATE_LIMIT).toBe(5);
    expect(ASSESSMENT_PHONE_WINDOW_SECONDS).toBe(86400);
  });

  test("S-RATE-03: redis key prefix is assessment-scoped", () => {
    expect(ASSESSMENT_RATE_LIMIT_KEY_PREFIX).toBe("assessment:rl:");
  });

  test("S-RATE-04: RATE_LIMITS object matches exported constants", () => {
    expect(RATE_LIMITS.ASSESSMENT_SOURCE_MAX_ATTEMPTS).toBe(ASSESSMENT_SOURCE_RATE_LIMIT);
    expect(RATE_LIMITS.ASSESSMENT_PHONE_MAX_SUBMISSIONS).toBe(ASSESSMENT_PHONE_RATE_LIMIT);
  });
});
