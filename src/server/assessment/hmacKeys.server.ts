import { createHmac } from "node:crypto";
import { normalizePhone } from "~/server/sms/phone";

export const HMAC_VERSION = "v1" as const;

export const HMAC_PREFIX_SOURCE = "v1:source:" as const;
export const HMAC_PREFIX_PHONE = "v1:phone:" as const;
export const HMAC_PREFIX_IDEMPOTENCY = "v1:idempotency:" as const;

/** @deprecated Use HMAC_PREFIX_* constants; kept for test domain-separation checks. */
export const HMAC_DOMAIN_SOURCE = "source";
/** @deprecated Use HMAC_PREFIX_* constants; kept for test domain-separation checks. */
export const HMAC_DOMAIN_PHONE = "phone";

export function normalizeAssessmentPhone(phone: string): string {
  return normalizePhone(phone);
}

export function buildCanonicalFingerprint(
  fields: Record<string, string>,
): string {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
}

function hmacDigest(prefix: string, message: string, secret: string): string {
  return createHmac("sha256", secret).update(`${prefix}${message}`).digest("hex");
}

export function sourceFingerprintKey(normalizedIp: string, secret: string): string {
  return hmacDigest(HMAC_PREFIX_SOURCE, normalizedIp, secret);
}

export function phoneFingerprintKey(phone: string, secret: string): string {
  const normalized = normalizeAssessmentPhone(phone);
  return hmacDigest(HMAC_PREFIX_PHONE, normalized, secret);
}

export function idempotencyFingerprintKey(
  canonicalValidatedSubmission: string,
  secret: string,
): string {
  return hmacDigest(HMAC_PREFIX_IDEMPOTENCY, canonicalValidatedSubmission, secret);
}

export function buildSourceFingerprint(input: {
  clientIp?: string;
  userAgent?: string;
}): string {
  return buildCanonicalFingerprint({
    clientIp: input.clientIp ?? "unknown",
    userAgent: input.userAgent ?? "unknown",
  });
}
