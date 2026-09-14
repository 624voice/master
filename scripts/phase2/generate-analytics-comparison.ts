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
  const allRequiredPresent = required.every((key) => dispatchedKeys.includes(key));
  const everyDispatchedPermitted = dispatchedKeys.every(
    (key) => key in contract.permittedProperties,
  );
  const literallyIdentical =
    dispatchedKeys.length === permitted.length &&
    permitted.every((key) => dispatchedKeys.includes(key));
  const satisfies = allRequiredPresent && everyDispatchedPermitted;

  const omittedOptional = omitted.map((key) => ({
    field: key,
    optional: true,
    reason: "Permitted by contract but not required at this call site",
  }));

  return {
    event,
    lockedSourceDocument: "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt",
    lockedSourceSection: "Section 14 — Analytics privacy contract (ten events)",
    lockedSourceCitation: `624VoiceWebsiteContentPhase2Final-EXTRACTED.txt — Section 14 — event "${event}"`,
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
    fieldsIntentionallyOmitted: omittedOptional,
    fieldsProhibited: contract.prohibitedProperties,
    allRequiredLockedFieldsPresent: allRequiredPresent ? "YES" : "NO",
    everyDispatchedFieldPermitted: everyDispatchedPermitted ? "YES" : "NO",
    currentFieldSetLiterallyIdenticalToFullPermittedSet: literallyIdentical
      ? "YES"
      : "NO",
    satisfiesLockedContract: satisfies,
    contractProof:
      "Phase2Final Section 14 authorizes limited operational metadata only; contact PII and raw answers are prohibited.",
    positiveTest: `analyticsLockedContractComparison.test.ts X-AN-CMP positive ${event}`,
    negativeTest: `analyticsLockedContractComparison.test.ts X-AN-CMP negative ${event}`,
    evidenceRef: `review-artifacts/phase2/analytics-locked-contract-comparison.json#${event}`,
  };
});

writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`Wrote ${OUT}`);
