import { getTradeKeys, type TradeKey } from "~/lib/roi/roiModel";
import {
  AssessmentEngine,
  getCalculatorDefaults,
  priorityOrder,
  respondDollarEstimateOrFallback,
  respondSeverity,
  resolveRespondInputs,
  type PriorityDimension,
  type RespondInputs,
  type RespondSeverityResult,
  type VisitorRespondEdits,
} from "./engine";
import {
  DIMENSION_LABELS,
  FOLLOWUP_IDS_BY_DIMENSION,
  SCREENING_IDS_BY_DIMENSION,
  type AssessmentDimension,
} from "./questions";
import type { RoiResult } from "~/lib/roi/computeRoi";

export type AssessmentAnswerMap = Record<string, string | number | undefined>;

export type DimensionResult = PriorityDimension;

export type RunAssessmentResult = {
  respondFields: RespondInputs;
  respondSeverity: RespondSeverityResult;
  dimensionResults: DimensionResult[];
  priorityGroups: DimensionResult[][];
  clarifyGroup: DimensionResult[];
  dollarEstimate: RoiResult[] | null;
  combinedLabel: string;
  activeQuestionIds: string[];
};

const SCORED_DIMENSIONS: AssessmentDimension[] = [
  "GF",
  "CV",
  "RG",
  "RM",
  "MI",
];

const FLEET_SIZE_TO_TRUCKS: Record<string, number> = {
  "1-2": 2,
  "3-7": 5,
  "8-20": 14,
  "21-50": 35,
  "50+": 50,
};

function resolveTruckCount(raw: AssessmentAnswerMap): number | undefined {
  if (typeof raw.truckCount === "number") {
    return raw.truckCount;
  }
  if (typeof raw.fleetSize === "string") {
    return FLEET_SIZE_TO_TRUCKS[raw.fleetSize];
  }
  if (typeof raw.BP2 === "string") {
    return FLEET_SIZE_TO_TRUCKS[raw.BP2];
  }
  if (typeof raw.BP2 === "number") {
    return raw.BP2;
  }
  return undefined;
}

const VALID_TRADES = new Set<string>(getTradeKeys());

function resolveTrade(raw: AssessmentAnswerMap): TradeKey | undefined {
  const trade = (raw.trade ?? raw.BP1) as string | undefined;
  if (!trade || !VALID_TRADES.has(trade)) return undefined;
  return trade as TradeKey;
}

function toVisitorRespondEdits(raw: AssessmentAnswerMap): VisitorRespondEdits {
  const monthlyCalls = raw.R1;
  const missedCallRatePct = raw.R2;
  const avgJobValue = raw.R3;

  return {
    monthlyCalls:
      monthlyCalls === "not_sure"
        ? "not_sure"
        : typeof monthlyCalls === "number"
          ? monthlyCalls
          : undefined,
    missedCallRatePct:
      missedCallRatePct === "not_sure"
        ? "not_sure"
        : typeof missedCallRatePct === "number"
          ? missedCallRatePct
          : undefined,
    avgJobValue:
      avgJobValue === "not_sure"
        ? "not_sure"
        : typeof avgJobValue === "number"
          ? avgJobValue
          : undefined,
  };
}

function applyScreeningAnswers(
  engine: AssessmentEngine,
  raw: AssessmentAnswerMap,
): void {
  for (const dimension of SCORED_DIMENSIONS) {
    const screeningId = SCREENING_IDS_BY_DIMENSION[dimension];
    const value = raw[screeningId];
    if (
      value === 0 ||
      value === 1 ||
      value === 2 ||
      value === 3 ||
      value === "not_sure"
    ) {
      engine.setAnswer(screeningId, value);
      engine.onScreeningAnswered(dimension, value);
    }
  }

  for (const dimension of SCORED_DIMENSIONS) {
    for (const followUpId of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
      const value = raw[followUpId];
      if (
        value === 0 ||
        value === 1 ||
        value === 2 ||
        value === 3 ||
        value === "not_sure"
      ) {
        engine.setAnswer(followUpId, value);
      }
    }
  }
}

export function runAssessment(raw: AssessmentAnswerMap): RunAssessmentResult {
  const trade = resolveTrade(raw);
  const truckCount = resolveTruckCount(raw);
  const defaults =
    trade && truckCount
      ? getCalculatorDefaults(trade, truckCount)
      : {
          monthlyCalls: 0,
          missedCallRatePct: 0,
          avgJobValue: 0,
        };

  const respondFields = resolveRespondInputs(defaults, toVisitorRespondEdits(raw));
  const respondSeverityResult = respondDollarEstimateOrFallback(
    trade,
    truckCount,
    respondFields.R1,
    respondFields.R2,
    respondFields.R3,
  );

  const engine = new AssessmentEngine();
  applyScreeningAnswers(engine, raw);

  const dimensionResults: DimensionResult[] = SCORED_DIMENSIONS.map(
    (dimension) => {
      const scored = engine.scoreDimension(dimension);
      const base = {
        key: dimension,
        label: DIMENSION_LABELS[dimension],
        confidence: scored.confidence,
      } as const;

      if (scored.status === "needs_clarification") {
        return { ...base, status: "needs_clarification" as const };
      }

      return {
        ...base,
        status: "scored" as const,
        band: scored.band,
        score: scored.score,
      };
    },
  );

  const respondScored = respondSeverity(respondFields.R2);
  const respondDimension: DimensionResult =
    respondScored.status === "needs_clarification"
      ? {
          key: "Respond",
          label: DIMENSION_LABELS.Respond,
          status: "needs_clarification",
          confidence: respondScored.confidence,
        }
      : {
          key: "Respond",
          label: DIMENSION_LABELS.Respond,
          status: "scored",
          band: respondScored.band,
          score: respondScored.score,
          confidence: respondScored.confidence,
        };

  const { rankedGroups, clarifyGroup } = priorityOrder([
    respondDimension,
    ...dimensionResults,
  ]);

  return {
    respondFields,
    respondSeverity: respondScored,
    dimensionResults,
    priorityGroups: rankedGroups,
    clarifyGroup,
    dollarEstimate: respondSeverityResult.estimate,
    combinedLabel: respondFields.label,
    activeQuestionIds: engine.getActiveQuestionIds(),
  };
}
