import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  phoneFingerprintKey,
  sourceFingerprintKey,
} from "~/server/assessment/hmacKeys.server";
import { LIMITED_PAYLOAD_ANALYTICS_EVENTS } from "~/lib/analytics/analyticsContract";
import { ANALYTICS_EVENTS } from "~/lib/analytics/trackEvent";

const REPO_ROOT = join(import.meta.dir, "../../..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const ASSESSMENT_CLIENT_PATHS = [
  "src/routes/assessment.tsx",
  "src/components/assessment/AssessmentGate.tsx",
  "src/components/assessment/AssessmentQuestion.tsx",
  "src/components/assessment/AssessmentResults.tsx",
  "src/components/assessment/AssessmentProgress.tsx",
  "src/components/assessment/RespondAssumptionsReview.tsx",
  "src/server/submitAssessmentLead.ts",
];

describe("Assessment browser and transport PII boundaries", () => {
  test("X-PII-01: Assessment client code does not persist PII in browser storage", () => {
    const forbidden = /localStorage|sessionStorage|IndexedDB|document\.cookie/i;
    for (const relativePath of ASSESSMENT_CLIENT_PATHS) {
      const source = readSource(relativePath);
      expect(source).not.toMatch(forbidden);
    }
  });

  test("X-PII-02: AssessmentGate keeps contact fields in transient React state only", () => {
    const gate = readSource("src/components/assessment/AssessmentGate.tsx");
    expect(gate).toContain("useState<LeadInfo>");
    expect(gate).toContain("onSubmit(normalizeLeadInfo(lead), smsConsent)");
    expect(gate).not.toMatch(/localStorage|sessionStorage/);
  });

  test("X-PII-03: report token URL carries opaque token only, no query-string PII", () => {
    const tokens = readSource("src/server/assessment/reportTokens.ts");
    expect(tokens).toContain('randomBytes(24).toString("hex")');
    expect(tokens).toMatch(/\/assessment-report\/\$\{token\}/);
    expect(tokens).not.toMatch(/\?|searchParams|email|phone|firstName/);
  });

  test("X-PII-04: four limited-payload events; six prohibit contact/answer/token; dispatch excludes raw contact", () => {
    const assessmentRoute = readSource("src/routes/assessment.tsx");
    const serverHandler = readSource("src/server/submitAssessmentLead.server.ts");

    for (const source of [assessmentRoute, serverHandler]) {
      expect(source).not.toMatch(/trackEvent\([^)]*email/i);
      expect(source).not.toMatch(/trackEvent\([^)]*phone/i);
      expect(source).not.toMatch(/trackEvent\([^)]*firstName/i);
    }

    expect(LIMITED_PAYLOAD_ANALYTICS_EVENTS.size).toBe(4);
    const expectedLimitedEvents = new Set<string>([
      ANALYTICS_EVENTS.lead_gate_complete,
      ANALYTICS_EVENTS.sms_consent_opt_in,
      ANALYTICS_EVENTS.assessment_complete,
      ANALYTICS_EVENTS.roi_agent_triggered,
    ]);
    for (const event of LIMITED_PAYLOAD_ANALYTICS_EVENTS) {
      expect(expectedLimitedEvents.has(event)).toBe(true);
    }

    const prohibitedCount = Object.values(ANALYTICS_EVENTS).filter(
      (event) => !LIMITED_PAYLOAD_ANALYTICS_EVENTS.has(event),
    ).length;
    expect(prohibitedCount).toBe(6);
  });

  test("X-PII-05: server-side Redis identifiers use domain-separated HMAC, not raw PII", () => {
    const rateLimit = readSource("src/server/assessment/rateLimitSource.ts");
    expect(rateLimit).toContain("phoneFingerprintKey");
    expect(rateLimit).toContain("sourceFingerprintKey");
    expect(rateLimit).toContain("idempotencyFingerprintKey");
    expect(rateLimit).not.toMatch(/redis\.set\([^)]*\+.*phone/);

    const secret = "test-secret-for-pii-boundary-check-only";
    const phoneKey = phoneFingerprintKey("(555) 123-4567", secret);
    const sourceKey = sourceFingerprintKey("203.0.113.1", secret);
    expect(phoneKey).not.toContain("555");
    expect(sourceKey).not.toContain("203.0.113");
  });

  test("X-PII-06: Assessment submission uses POST body transport, not URL query parameters", () => {
    const client = readSource("src/server/submitAssessmentLead.ts");
    const route = readSource("src/routes/assessment.tsx");
    expect(client).toContain('createServerFn({ method: "POST" })');
    expect(route).toContain("submitAssessmentLead({");
    expect(route).not.toMatch(/URLSearchParams|window\.location\.search/);
  });
});
