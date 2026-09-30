/**
 * S-IP/S-SEC → S-PL semantic equivalence disposition table.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dir, "../../review-artifacts/phase2");

const rows = [
  {
    formerId: "S-IP-01",
    testFile: "src/server/assessment/getTrustedClientIp.test.ts",
    executableTestName: "S-PL-01: returns platform-resolved client IP",
    assertion: "getTrustedClientIp() returns platform getRequestIP() value",
    proposedApprovedId: "S-PL-01",
    v4Definition: "Trusted client IP resolves from platform request context",
    semanticEquivalence:
      "Same IP resolution behavior; remapped to pipeline (S-PL) namespace because IP feeds rate-limit pipeline not standalone IP module",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-01",
  },
  {
    formerId: "S-IP-02",
    testFile: "src/server/assessment/getTrustedClientIp.test.ts",
    executableTestName: "S-PL-02: returns undefined when platform IP is unavailable",
    assertion: "Returns undefined when getRequestIP returns undefined",
    proposedApprovedId: "S-PL-02",
    v4Definition: "Fail-safe when platform IP unavailable",
    semanticEquivalence: "Identical unavailable-IP handling; pipeline prerequisite for source fingerprint",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-02",
  },
  {
    formerId: "S-IP-03",
    testFile: "src/server/assessment/getTrustedClientIp.test.ts",
    executableTestName: "S-PL-03: requests xForwardedFor trust from platform helper",
    assertion: "getRequestIP called with xForwardedFor: true",
    proposedApprovedId: "S-PL-03",
    v4Definition: "Platform helper invoked with forwarded-for trust flag",
    semanticEquivalence: "Same trustForwardedFor contract for edge IP extraction",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-03",
  },
  {
    formerId: "S-SEC-01",
    testFile: "src/server/assessment/assessmentSecurity.test.ts",
    executableTestName: "S-PL-04: returns null when secret env var is missing",
    assertion: "getAssessmentSecurityHmacSecret() null without env",
    proposedApprovedId: "S-PL-04",
    v4Definition: "Assessment HMAC secret absent returns null",
    semanticEquivalence: "Same fail-closed secret loading; grouped under pipeline security (S-PL)",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-04",
  },
  {
    formerId: "S-SEC-02",
    testFile: "src/server/assessment/assessmentSecurity.test.ts",
    executableTestName: "S-PL-05: returns null when secret is shorter than 32 chars",
    assertion: "Short secret rejected",
    proposedApprovedId: "S-PL-05",
    v4Definition: "Minimum secret length enforcement",
    semanticEquivalence: "Identical minimum-length guard before HMAC use",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-05",
  },
  {
    formerId: "S-SEC-03",
    testFile: "src/server/assessment/assessmentSecurity.test.ts",
    executableTestName: "S-PL-06: returns trimmed secret when configured",
    assertion: "Valid secret returned trimmed",
    proposedApprovedId: "S-PL-06",
    v4Definition: "Configured secret normalized",
    semanticEquivalence: "Same trimming behavior for configured secret",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-06",
  },
  {
    formerId: "S-SEC-04",
    testFile: "src/server/assessment/assessmentSecurity.test.ts",
    executableTestName: "S-PL-07: isAssessmentSecurityConfigured fails closed without secret",
    assertion: "isAssessmentSecurityConfigured() false without secret",
    proposedApprovedId: "S-PL-07",
    v4Definition: "Configured check fails closed",
    semanticEquivalence: "Same boolean configured gate used by submit pipeline",
    otherTestOnTargetId: false,
    finalDisposition: "Remapped to S-PL-07",
  },
];

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "s-pl-disposition-table.json"), JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} disposition rows`);
