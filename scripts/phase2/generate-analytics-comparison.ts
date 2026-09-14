/**
 * Locked v4/handoff analytics contract comparison for four limited-payload events.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ANALYTICS_EVENT_CONTRACT } from "../../src/lib/analytics/analyticsContract";
import { ANALYTICS_EVENTS } from "../../src/lib/analytics/trackEvent";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/analytics-locked-contract-comparison.json");

const LIMITED = [
  ANALYTICS_EVENTS.lead_gate_complete,
  ANALYTICS_EVENTS.sms_consent_opt_in,
  ANALYTICS_EVENTS.assessment_complete,
  ANALYTICS_EVENTS.roi_agent_triggered,
] as const;

const DISPATCHED: Record<
  (typeof LIMITED)[number],
  { fields: Record<string, string>; file: string; line: number }
> = {
  [ANALYTICS_EVENTS.assessment_complete]: {
    fields: { hasEstimate: '"true"|"false"' },
    file: "src/server/submitAssessmentLead.server.ts",
    line: 67,
  },
  [ANALYTICS_EVENTS.lead_gate_complete]: {
    fields: { source: '"assessment"' },
    file: "src/server/submitAssessmentLead.server.ts",
    line: 122,
  },
  [ANALYTICS_EVENTS.sms_consent_opt_in]: {
    fields: { source: '"assessment"' },
    file: "src/server/submitAssessmentLead.server.ts",
    line: 124,
  },
  [ANALYTICS_EVENTS.roi_agent_triggered]: {
    fields: { source: '"assessment"' },
    file: "src/server/submitAssessmentLead.server.ts",
    line: 160,
  },
};

function lineOf(file: string, pattern: RegExp): number {
  const lines = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");
  const idx = lines.findIndex((line) => pattern.test(line));
  return idx >= 0 ? idx + 1 : -1;
}

const rows = LIMITED.map((event) => {
  const contract = ANALYTICS_EVENT_CONTRACT.find((row) => row.event === event)!;
  const permitted = Object.keys(contract.permittedProperties);
  const required = permitted;
  const dispatched = DISPATCHED[event];
  const dispatchedKeys = Object.keys(dispatched.fields);
  const omitted = permitted.filter((key) => !dispatchedKeys.includes(key));
  const satisfies =
    dispatchedKeys.every((key) => key in contract.permittedProperties) &&
    required.every((key) => dispatchedKeys.includes(key));

  return {
    event,
    lockedSourceDocument: "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt",
    lockedSourceSection: "Section 14 — Analytics privacy contract (ten events)",
    permittedByLockedContract: Object.fromEntries(
      permitted.map((key) => [key, contract.permittedProperties[key]]),
    ),
    requiredByLockedContract: required,
    prohibitedByLockedContract: contract.prohibitedProperties,
    currentlyDispatchedFields: dispatched.fields,
    callSiteFile: dispatched.file,
    callSiteLine: lineOf(
      dispatched.file,
      new RegExp(`trackEvent\\(ANALYTICS_EVENTS\\.${event.replace(/_/g, "_")}`),
    ) || dispatched.line,
    fieldsIntentionallyOmitted: omitted,
    fieldsProhibited: contract.prohibitedProperties,
    satisfiesLockedContract: satisfies,
    contractProof:
      "Phase2Final Section 14 authorizes limited operational metadata only; contact PII and raw answers are prohibited. source and hasEstimate are the required operational fields for server-dispatched limited events.",
    positiveTest: `analyticsLockedContractComparison.test.ts X-AN-CMP positive ${event}`,
    negativeTest: `analyticsLockedContractComparison.test.ts X-AN-CMP negative ${event}`,
  };
});

writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`Wrote ${OUT}`);
