import { describe, expect, test } from "bun:test";
import { buildAssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";
import { runAssessment } from "~/lib/assessment/runAssessment";
import { formatCurrency } from "~/lib/roi/formatCurrency";

const FIXED_DATE = new Date("2026-03-15T15:00:00.000Z");

const assessmentAnswers = {
  BP1: "HVAC",
  BP2: "3-7",
  R1: 300,
  R2: 15,
  R3: 350,
  "GF-S": 2,
  "GF-F1": 1,
  "GF-F2": 2,
  "GF-F3": 0,
  "CV-S": 1,
  "CV-F1": "not_sure",
  "RG-S": 0,
  "RM-S": 3,
  "RM-F1": 2,
  "RM-F2": 2,
  "RM-F3": 2,
  "MI-S": 2,
  "MI-F1": 0,
  "MI-F2": 1,
  "MI-F3": 2,
};

describe("buildAssessmentReportViewModel supplemental", () => {
  const result = runAssessment(assessmentAnswers);
  const viewModel = buildAssessmentReportViewModel(result, FIXED_DATE);

  test("S-PDF-01: formats moderate annual benefit from scenarioIndex 1", () => {
    const moderate = result.dollarEstimate?.find(
      (scenario) => scenario.scenarioIndex === 1,
    );

    expect(moderate).toBeDefined();
    expect(viewModel.moderateAnnualBenefitFormatted).toBe(
      formatCurrency(moderate!.totalAnnualBenefit),
    );
  });

  test("S-PDF-02: exposes respond assumptions and combined label", () => {
    expect(viewModel.combinedLabel).toBe(result.combinedLabel);
    expect(viewModel.respondAssumptions).toEqual({
      monthlyCalls: result.respondFields.R1.value,
      missedCallRatePct: result.respondFields.R2.value,
      avgJobValue: result.respondFields.R3.value,
      r1Source: result.respondFields.R1.source,
      r2Source: result.respondFields.R2.source,
      r3Source: result.respondFields.R3.source,
    });
    expect(viewModel.generatedAtIso).toBe(FIXED_DATE.toISOString());
  });

  test("S-PDF-03: includes ranked groups, clarify group, and disclaimer", () => {
    expect(viewModel.rankedGroups.length).toBe(result.priorityGroups.length);
    expect(viewModel.clarifyGroup.length).toBe(result.clarifyGroup.length);
    expect(viewModel.disclaimer).toContain("directional");
    expect(viewModel.disclaimer).toContain("paid AI Revenue and Operations Diagnostic");
  });
});
