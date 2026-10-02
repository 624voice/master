import { describe, expect, test } from "bun:test";
import { runAssessment } from "~/lib/assessment/runAssessment";
import { validateAssessmentAnswers } from "~/lib/assessment/validateAssessmentAnswers";
import { buildAssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";

const answers = {
  BP1: "HVAC",
  BP2: "3-7",
  R1: 300,
  R2: 15,
  R3: 350,
  "GF-S": 2,
  "CV-S": 1,
  "RG-S": 1,
  "RM-S": 1,
  "MI-S": 1,
};

describe("assessment client/server parity S-ASSESS-PARITY", () => {
  test("S-ASSESS-PARITY-01: validated answers produce same engine output client-side", () => {
    const validated = validateAssessmentAnswers(answers);
    expect(validated).not.toHaveProperty("error");
    if ("answers" in validated) {
      const result = runAssessment(validated.answers);
      expect(result.priorityGroups.length).toBeGreaterThan(0);
    }
  });

  test("S-ASSESS-PARITY-02: dollar estimate shape matches between runAssessment and view model", () => {
    const assessment = runAssessment(answers);
    const vm = buildAssessmentReportViewModel(assessment);
    expect(vm.moderateAnnualBenefitFormatted).toBeTruthy();
    expect(assessment.dollarEstimate?.length).toBe(3);
  });

  test("S-ASSESS-PARITY-03: combined provenance label preserved in view model", () => {
    const assessment = runAssessment(answers);
    const vm = buildAssessmentReportViewModel(assessment);
    expect(vm.combinedLabel).toBe(assessment.combinedLabel);
  });

  test("S-ASSESS-PARITY-04: clarify group preserved in view model", () => {
    const assessment = runAssessment(answers);
    const vm = buildAssessmentReportViewModel(assessment);
    expect(vm.clarifyGroup.length).toBe(assessment.clarifyGroup.length);
  });

  test("S-ASSESS-PARITY-05: respond assumptions copied to view model", () => {
    const assessment = runAssessment(answers);
    const vm = buildAssessmentReportViewModel(assessment);
    expect(vm.respondAssumptions.monthlyCalls).toBe(assessment.respondFields.R1.value);
    expect(vm.respondAssumptions.r1Source).toBe(assessment.respondFields.R1.source);
  });
});
