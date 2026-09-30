import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  HMAC_PREFIX_IDEMPOTENCY,
  HMAC_PREFIX_PHONE,
  HMAC_PREFIX_SOURCE,
  buildCanonicalFingerprint,
  idempotencyFingerprintKey,
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

  test("S-HMAC-03: sourceFingerprintKey uses v1:source: domain separation", () => {
    const secret = "test-secret";
    const key = sourceFingerprintKey("203.0.113.1", secret);
    expect(key).toHaveLength(64);
    expect(key).not.toBe(sourceFingerprintKey("203.0.113.2", secret));
  });

  test("S-HMAC-04: phoneFingerprintKey uses v1:phone: domain", () => {
    const secret = "test-secret";
    const phoneKey = phoneFingerprintKey("(555) 123-4567", secret);
    const otherKey = phoneFingerprintKey("+15559876543", secret);
    expect(phoneKey).not.toBe(otherKey);
  });

  test("S-HMAC-05: domain prefixes are distinct", () => {
    expect(HMAC_PREFIX_SOURCE).toBe("v1:source:");
    expect(HMAC_PREFIX_PHONE).toBe("v1:phone:");
    expect(HMAC_PREFIX_IDEMPOTENCY).toBe("v1:idempotency:");
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
    const sourceKey = sourceFingerprintKey(rawIp, secret);

    expect(phoneKey).not.toContain("555");
    expect(phoneKey).not.toContain("123");
    expect(sourceKey).not.toContain(rawIp);
  });

  test("S-HMAC-08: digest uses v1:source: prefix in HMAC message", () => {
    const secret = "test-secret";
    const normalizedIp = "203.0.113.1";
    const expected = createHmac("sha256", secret)
      .update(`${HMAC_PREFIX_SOURCE}${normalizedIp}`)
      .digest("hex");

    expect(sourceFingerprintKey(normalizedIp, secret)).toBe(expected);
  });

  test("S-HMAC-09: idempotencyFingerprintKey uses v1:idempotency: prefix", () => {
    const secret = "test-secret";
    const canonical = '{"answers":{},"lead":{}}';
    const expected = createHmac("sha256", secret)
      .update(`${HMAC_PREFIX_IDEMPOTENCY}${canonical}`)
      .digest("hex");

    expect(idempotencyFingerprintKey(canonical, secret)).toBe(expected);
  });

  test("S-HMAC-10: idempotency and source digests differ for same payload string", () => {
    const secret = "test-secret";
    const payload = "203.0.113.1";
    expect(idempotencyFingerprintKey(payload, secret)).not.toBe(
      sourceFingerprintKey(payload, secret),
    );
  });
});
