import { createHmac } from "node:crypto";
import { normalizePhone } from "~/server/sms/phone";

export const HMAC_VERSION = "v1" as const;

export const HMAC_DOMAIN_SOURCE = "assessment:rate:source";
export const HMAC_DOMAIN_PHONE = "assessment:rate:phone";

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

function hmacDigest(domain: string, message: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${HMAC_VERSION}:${domain}:${message}`)
    .digest("hex");
}

export function sourceFingerprintKey(
  canonicalFingerprint: string,
  secret: string,
): string {
  return hmacDigest(HMAC_DOMAIN_SOURCE, canonicalFingerprint, secret);
}

export function phoneFingerprintKey(phone: string, secret: string): string {
  const normalized = normalizeAssessmentPhone(phone);
  return hmacDigest(HMAC_DOMAIN_PHONE, normalized, secret);
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
