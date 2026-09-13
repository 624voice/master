import { createHmac } from "node:crypto";
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

describe("hmacKeys supplemental", () => {
  test("S-HMAC-01: buildCanonicalFingerprint sorts keys and joins canonically", () => {
    expect(
      buildCanonicalFingerprint({
        b: "2",
        a: "1",
        c: "3",
      }),
    ).toBe("a=1\nb=2\nc=3");
  });

  test("S-HMAC-02: normalizeAssessmentPhone normalizes to E.164", () => {
    expect(normalizeAssessmentPhone("(555) 123-4567")).toBe("+15551234567");
  });

  test("S-HMAC-03: sourceFingerprintKey uses v1 domain separation", () => {
    const secret = "test-secret";
    const canonical = buildSourceFingerprint({
      clientIp: "203.0.113.1",
      userAgent: "curl/8.0",
    });
    const key = sourceFingerprintKey(canonical, secret);
    expect(key).toHaveLength(64);
    expect(key).not.toBe(sourceFingerprintKey("other", secret));
  });

  test("S-HMAC-04: phoneFingerprintKey uses phone domain", () => {
    const secret = "test-secret";
    const phoneKey = phoneFingerprintKey("(555) 123-4567", secret);
    const otherKey = phoneFingerprintKey("+15559876543", secret);
    expect(phoneKey).not.toBe(otherKey);
  });

  test("S-HMAC-05: domain constants are distinct", () => {
    expect(HMAC_VERSION).toBe("v1");
    expect(HMAC_DOMAIN_SOURCE).not.toBe(HMAC_DOMAIN_PHONE);
  });

  test("S-HMAC-06: source and phone domains produce different digests", () => {
    const secret = "test-secret";
    const normalizedPhone = normalizeAssessmentPhone("(555) 123-4567");
    const sourceKey = sourceFingerprintKey(normalizedPhone, secret);
    const phoneKey = phoneFingerprintKey(normalizedPhone, secret);
    expect(sourceKey).not.toBe(phoneKey);
  });

  test("S-HMAC-07: fingerprint keys do not embed raw PII", () => {
    const secret = "test-secret";
    const rawPhone = "(555) 123-4567";
    const rawIp = "203.0.113.50";
    const phoneKey = phoneFingerprintKey(rawPhone, secret);
    const sourceKey = sourceFingerprintKey(
      buildSourceFingerprint({ clientIp: rawIp, userAgent: "Mozilla/5.0" }),
      secret,
    );

    expect(phoneKey).not.toContain("555");
    expect(phoneKey).not.toContain("123");
    expect(sourceKey).not.toContain(rawIp);
    expect(sourceKey).not.toContain("Mozilla");
  });

  test("S-HMAC-08: digest includes version prefix in HMAC message", () => {
    const secret = "test-secret";
    const message = "clientIp=203.0.113.1\nuserAgent=curl/8.0";
    const expected = createHmac("sha256", secret)
      .update(`${HMAC_VERSION}:${HMAC_DOMAIN_SOURCE}:${message}`)
      .digest("hex");

    expect(sourceFingerprintKey(message, secret)).toBe(expected);
  });
});
