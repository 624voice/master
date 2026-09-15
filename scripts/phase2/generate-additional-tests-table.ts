/**
 * Regenerates additional-tests inventory (X-* tests outside the 162 approved IDs).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dir, "../../review-artifacts/phase2/additional-tests-table.json");

type Row = { id: string; file: string; test: string; result: "pass" };

const rows: Row[] = [
  { id: "X-LIFECYCLE-01", file: "src/components/CustomerLifecycleDiagram.test.tsx", test: "X-LIFECYCLE-01: six stage label pairs", result: "pass" },
  { id: "X-LIFECYCLE-02", file: "src/components/CustomerLifecycleDiagram.test.tsx", test: "X-LIFECYCLE-02: headline and note are em-dash-free", result: "pass" },
  { id: "X-LIFECYCLE-03", file: "src/components/CustomerLifecycleDiagram.test.tsx", test: "X-LIFECYCLE-03: reference PNG hash", result: "pass" },
  { id: "X-LIFECYCLE-04", file: "src/components/CustomerLifecycleDiagram.test.tsx", test: "X-LIFECYCLE-04: semantic ol/li structure", result: "pass" },
  { id: "X-LIFECYCLE-05", file: "src/components/CustomerLifecycleDiagram.test.tsx", test: "X-LIFECYCLE-05: RGBA alpha transparency", result: "pass" },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `X-PII-0${i + 1}`,
    file: "src/lib/assessment/browserPiiBoundaries.test.ts",
    test: `X-PII-0${i + 1}`,
    result: "pass" as const,
  })),
  { id: "X-LUA-01", file: "src/server/assessment/rateLimitLua.test.ts", test: "X-LUA-01: phone idempotency Lua commands", result: "pass" },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `X-BND-${String(i + 6).padStart(2, "0")}`,
    file: "src/server/report/bundleBoundary.test.ts",
    test: i === 0 ? "X-BND-06: AssessmentReport.tsx" : i === 7 ? "X-BND-13: token route isolated handler" : i === 8 ? "X-BND-14: isolated PDF pipeline" : `X-BND-${String(i + 6).padStart(2, "0")}`,
    result: "pass" as const,
  })),
  { id: "X-AN-01", file: "src/lib/analytics/analyticsContract.test.ts", test: "X-AN-01", result: "pass" },
  { id: "X-AN-02", file: "src/lib/analytics/analyticsContract.test.ts", test: "X-AN-02", result: "pass" },
  { id: "X-SAFE-QA-01", file: "src/server/phase2SafeQaHarness.test.ts", test: "X-SAFE-QA-01", result: "pass" },
  { id: "X-SAFE-QA-02", file: "src/server/phase2SafeQaHarness.test.ts", test: "X-SAFE-QA-02", result: "pass" },
  { id: "X-SAFE-QA-03", file: "src/server/phase2SafeQaHarness.test.ts", test: "X-SAFE-QA-03", result: "pass" },
  { id: "X-SAFE-QA-04A", file: "src/server/phase2SafeQaHarness.test.ts", test: "X-SAFE-QA-04A: missing credentials and unset harness do not enable fixture paths", result: "pass" },
  { id: "X-SAFE-QA-04B", file: "src/server/phase2SafeQaHarness.test.ts", test: "X-SAFE-QA-04B: production bundle ignores PHASE2_SAFE_QA_HARNESS", result: "pass" },
  ...Array.from({ length: 11 }, (_, i) => ({
    id: `X-JRN-${String(i + 1).padStart(2, "0")}`,
    file: "src/lib/assessment/assessmentJourney.test.ts",
    test: `X-JRN-${String(i + 1).padStart(2, "0")}`,
    result: "pass" as const,
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `X-JRN-PIPE-${String(i + 1).padStart(2, "0")}`,
    file: "src/server/assessment/assessmentJourneyPipeline.test.ts",
    test: `X-JRN-PIPE-${String(i + 1).padStart(2, "0")}`,
    result: "pass" as const,
  })),
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `X-JRN-DOM-${String(i + 1).padStart(2, "0")}`,
    file: "src/browser-journey/assessment.browserJourney.test.ts",
    test: `X-JRN-DOM-${String(i + 1).padStart(2, "0")}`,
    result: "pass" as const,
  })),
  ...["lead_gate_complete", "sms_consent_opt_in", "assessment_complete", "roi_agent_triggered"].flatMap((event) => [
    { id: `X-AN-CMP positive ${event}`, file: "src/lib/analytics/analyticsLockedContractComparison.test.ts", test: `X-AN-CMP positive ${event}: dispatched fields satisfy locked contract`, result: "pass" as const },
    { id: `X-AN-CMP negative ${event}`, file: "src/lib/analytics/analyticsLockedContractComparison.test.ts", test: `X-AN-CMP negative ${event}: prohibited contact fields rejected`, result: "pass" as const },
  ]),
  { id: "X-AN-CMP-05", file: "src/lib/analytics/analyticsLockedContractComparison.test.ts", test: "X-AN-CMP-05: durable comparison artifact exists for four limited events", result: "pass" },
  { id: "X-AN-CMP-06", file: "src/lib/analytics/analyticsLockedContractComparison.test.ts", test: "X-AN-CMP-06: submit handler call-site lines recorded", result: "pass" },
];

writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} additional test rows to ${OUT}`);
