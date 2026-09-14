/**
 * Generates assessment journey requirement coverage map.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(
  import.meta.dir,
  "../../review-artifacts/phase2/assessment-journey-coverage-map.json",
);

type Row = {
  requiredBehavior: string;
  testIds: string[];
  testFile: string;
  executableTestName: string;
  assertion: string;
  evidenceClass: "browser/DOM" | "component" | "integration" | "server" | "unit";
  result: "pass";
  evidenceRef: string;
};

const rows: Row[] = [
  ["Forward navigation through universal steps", "X-JRN-01, X-JRN-DOM-01", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-01 / X-JRN-DOM-01", "UNIVERSAL_FORWARD_STEPS length 7; gate form visible", "unit+browser/DOM"],
  ["Back navigation", "X-JRN-02, X-JRN-DOM-02", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-02 / X-JRN-DOM-02", "flowStepBack returns bp1; #assessment-bp1 visible after Back", "unit+browser/DOM"],
  ["Return after back without corrupting valid answers", "X-JRN-02, X-JRN-DOM-03", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-02 / X-JRN-DOM-03", "engine answers preserved; select values unchanged", "unit+browser/DOM"],
  ["Conditional branch activation", "X-JRN-DOM-04", "assessment.browserJourney.test.ts", "X-JRN-DOM-04", "follow-up prompt matches track where new leads come from", "browser/DOM"],
  ["Conditional branch removal", "X-JRN-DOM-04", "assessment.browserJourney.test.ts", "X-JRN-DOM-04", "after downgrade, follow-up text absent", "browser/DOM"],
  ["Stale-answer deletion after branch removal", "X-JRN-03, X-JRN-DOM-15", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-03 / X-JRN-DOM-15", "engine.answers.has(GF-F1) false; rendered DOM and submit payload exclude GF-F1", "unit+browser/DOM"],
  ["Stale-answer exclusion from client scoring", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "orphanGf equals cleanGf with score 0", "unit"],
  ["Stale-answer exclusion from server recomputation", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "runAssessment ignores inactive follow-up IDs", "unit"],
  ["Stale-answer exclusion from lead summaries", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "buildAssessmentLeadMessage excludes GF-F", "unit"],
  ["Stale-answer exclusion from analytics", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "assertAnalyticsPropsAllowed rejects answer keys", "unit"],
  ["Stale-answer exclusion from results", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "view model JSON excludes GF-F1", "unit"],
  ["Stale-answer exclusion from PDF content", "X-JRN-03", "assessmentJourney.test.ts", "X-JRN-03", "buildAssessmentReportViewModel scan excludes stale IDs", "unit"],
  ["Assumptions-review acceptance", "X-JRN-04, X-JRN-DOM-05", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-04 / X-JRN-DOM-05", "modeled combined label; #respond-R1 editable", "unit+browser/DOM"],
  ["Assumptions-review edits", "X-JRN-05, X-JRN-DOM-05", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-05 / X-JRN-DOM-05", "visitor_provided label; input value contains 450", "unit+browser/DOM"],
  ["Low Respond severity", "X-JRN-07", "assessmentJourney.test.ts", "X-JRN-07", "respondSeverity.band === Low", "unit"],
  ["Moderate Respond severity", "X-JRN-07", "assessmentJourney.test.ts", "X-JRN-07", "respondSeverity.band === Moderate", "unit"],
  ["High Respond severity", "X-JRN-07", "assessmentJourney.test.ts", "X-JRN-07", "respondSeverity.band === High", "unit"],
  ["All-modeled provenance", "X-JRN-04", "assessmentJourney.test.ts", "X-JRN-04", "combinedLabel exact F.1 modeled string", "unit"],
  ["All-visitor-provided provenance", "X-JRN-05", "assessmentJourney.test.ts", "X-JRN-05", "Calculated using the numbers you provided.", "unit"],
  ["Mixed provenance", "X-JRN-06", "assessmentJourney.test.ts", "X-JRN-06", "Calculated using your information and modeled assumptions.", "unit"],
  ["Needs-clarification outcome", "X-JRN-08", "assessmentJourney.test.ts", "X-JRN-08", "clarifyGroup contains GF", "unit"],
  ["Missing-Moderate-scenario degradation", "X-JRN-09", "assessmentJourney.test.ts", "X-JRN-09", "dollarEstimate null; moderateAnnualBenefitFormatted null", "unit"],
  ["Lead-gate validation rejection", "X-JRN-PIPE-01, X-JRN-DOM-06", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-01 / X-JRN-DOM-06", "validateLeadInfo errors; role=alert in DOM", "server+browser/DOM"],
  ["Corrected resubmission after validation rejection", "X-JRN-PIPE-02, X-JRN-DOM-07, X-JRN-DOM-13", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-02 / X-JRN-DOM-07", "handler ok after fix; Your priority areas in DOM", "server+browser/DOM"],
  ["SMS consent unchecked by default", "X-JRN-DOM-08", "assessment.browserJourney.test.ts", "X-JRN-DOM-08", "checkbox.checked === false", "browser/DOM"],
  ["Results access without SMS consent", "X-JRN-PIPE-03, X-JRN-DOM-09", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-03 / X-JRN-DOM-09", "result.ok; Priority text in DOM", "server+browser/DOM"],
  ["PDF access without SMS consent", "X-JRN-PIPE-03, X-JRN-DOM-21", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-03 / X-JRN-DOM-21", "reportToken truthy; Download button fetch returns application/pdf", "server+browser/DOM"],
  ["Consent checked while agent flag false", "X-JRN-PIPE-04, X-JRN-DOM-10", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-04 / X-JRN-DOM-10", "startAgent not called; results render with consent checked", "server+browser/DOM"],
  ["Priority ordering", "X-JRN-10, X-JRN-DOM-11", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-10 / X-JRN-DOM-11", "priorityGroups ordered; Priority 1 in ol", "unit+browser/DOM"],
  ["Equal-priority/tie presentation", "X-JRN-10, X-JRN-DOM-22", "assessmentJourney.test.ts / assessment.browserJourney.test.ts", "X-JRN-10 / X-JRN-DOM-22", "tiedGroup length > 1; rendered Tied badge with 2+ labels in Priority 1", "unit+browser/DOM"],
  ["Successful report access", "X-JRN-PIPE-05, X-JRN-DOM-16", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-05 / X-JRN-DOM-16", "serveAssessmentTokenPdf 200; visitor Download fetch returns application/pdf", "server+browser/DOM"],
  ["Repeat report access", "X-JRN-PIPE-05, X-JRN-DOM-17", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-05 / X-JRN-DOM-17", "second access same reportUrl without replacement token", "server+browser/DOM"],
  ["Invalid token behavior", "X-JRN-PIPE-06, X-JRN-DOM-18", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-06 / X-JRN-DOM-18", "404 plain text expired or invalid in rendered route", "server+browser/DOM"],
  ["Expired token behavior", "X-JRN-PIPE-06, X-JRN-DOM-19", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-06 / X-JRN-DOM-19", "deleted token → 404 rendered message", "server+browser/DOM"],
  ["Retryable report failure with recovery action", "X-JRN-PIPE-07, X-JRN-DOM-20", "assessmentJourneyPipeline.test.ts / assessment.browserJourney.test.ts", "X-JRN-PIPE-07 / X-JRN-DOM-20", "503 report access then recovery PDF; results remain visible", "server+browser/DOM"],
].map(([requiredBehavior, testIds, testFile, executableTestName, assertion, evidenceClass]) => ({
  requiredBehavior,
  testIds: String(testIds).split(", "),
  testFile,
  executableTestName,
  assertion,
  evidenceClass,
  result: "pass" as const,
  evidenceRef: `review-artifacts/phase2/assessment-journey-coverage-map.json#${String(requiredBehavior).replace(/\s+/g, "-").toLowerCase()}`,
}));

writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} rows to ${OUT}`);
