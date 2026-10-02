import { formatCurrency } from "~/lib/roi/formatCurrency";
import type { RunAssessmentResult } from "./runAssessment";

export type AssessmentReportDimensionView = {
  label: string;
  status: "scored" | "needs_clarification";
  band?: string;
  confidence: string;
};

export type AssessmentReportViewModel = {
  generatedAtIso: string;
  combinedLabel: string;
  respondAssumptions: {
    monthlyCalls: number;
    missedCallRatePct: number;
    avgJobValue: number;
    r1Source: string;
    r2Source: string;
    r3Source: string;
  };
  moderateAnnualBenefitFormatted: string | null;
  rankedGroups: AssessmentReportDimensionView[][];
  clarifyGroup: AssessmentReportDimensionView[];
  disclaimer: string;
};

const DISCLAIMER =
  "This Assessment is directional and based on the information you provided. It is a starting point, not a full operational diagnosis. A paid AI Revenue and Operations Diagnostic is used only when a deeper review is warranted.";

function toDimensionView(
  dimension: RunAssessmentResult["priorityGroups"][number][number],
): AssessmentReportDimensionView {
  return {
    label: dimension.label,
    status: dimension.status,
    band: dimension.band,
    confidence: dimension.confidence,
  };
}

export function buildAssessmentReportViewModel(
  result: RunAssessmentResult,
  generatedAt: Date = new Date(),
): AssessmentReportViewModel {
  const moderate =
    result.dollarEstimate?.find((scenario) => scenario.scenarioIndex === 1) ??
    null;

  return {
    generatedAtIso: generatedAt.toISOString(),
    combinedLabel: result.combinedLabel,
    respondAssumptions: {
      monthlyCalls: result.respondFields.R1.value,
      missedCallRatePct: result.respondFields.R2.value,
      avgJobValue: result.respondFields.R3.value,
      r1Source: result.respondFields.R1.source,
      r2Source: result.respondFields.R2.source,
      r3Source: result.respondFields.R3.source,
    },
    moderateAnnualBenefitFormatted: moderate
      ? formatCurrency(moderate.totalAnnualBenefit)
      : null,
    rankedGroups: result.priorityGroups.map((group) =>
      group.map((dimension) => toDimensionView(dimension)),
    ),
    clarifyGroup: result.clarifyGroup.map((dimension) =>
      toDimensionView(dimension),
    ),
    disclaimer: DISCLAIMER,
  };
}
