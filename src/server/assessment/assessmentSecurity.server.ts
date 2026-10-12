/** Server-only HMAC secret for Assessment rate limiting and idempotency. */
export function getAssessmentSecurityHmacSecret(): string | null {
  const secret = process.env.ASSESSMENT_SECURITY_HMAC_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

export function isAssessmentSecurityConfigured(): boolean {
  return getAssessmentSecurityHmacSecret() !== null;
}
