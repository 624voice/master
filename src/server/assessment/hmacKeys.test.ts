import { describe, expect, test } from "bun:test";
import {
  buildCanonicalFingerprint,
  buildSourceFingerprint,
  HMAC_DOMAIN_PHONE,
  HMAC_DOMAIN_SOURCE,
  HMAC_VERSION,
  normalizeAssessmentPhone,
  phoneFingerprintKey,
  sourceFingerprintKey,
} from "~/server/assessment/hmacKeys.server";

describe("hmacKeys", () => {
  test("buildCanonicalFingerprint sorts keys and joins canonically", () => {
    expect(
      buildCanonicalFingerprint({
        b: "2",
        a: "1",
        c: "3",
      }),
    ).toBe("a=1\nb=2\nc=3");
  });

  test("normalizeAssessmentPhone normalizes to E.164", () => {
    expect(normalizeAssessmentPhone("(555) 123-4567")).toBe("+15551234567");
  });

  test("sourceFingerprintKey uses v1 domain separation", () => {
    const secret = "test-secret";
    const canonical = buildSourceFingerprint({
      clientIp: "203.0.113.1",
      userAgent: "curl/8.0",
    });
    const key = sourceFingerprintKey(canonical, secret);
    expect(key).toHaveLength(64);
    expect(key).not.toBe(sourceFingerprintKey("other", secret));
  });

  test("phoneFingerprintKey uses phone domain", () => {
    const secret = "test-secret";
    const phoneKey = phoneFingerprintKey("(555) 123-4567", secret);
    const otherKey = phoneFingerprintKey("+15559876543", secret);
    expect(phoneKey).not.toBe(otherKey);
  });

  test("domain constants are distinct", () => {
    expect(HMAC_VERSION).toBe("v1");
    expect(HMAC_DOMAIN_SOURCE).not.toBe(HMAC_DOMAIN_PHONE);
  });
});
