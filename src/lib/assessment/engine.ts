import {
  computeAllScenariosWithOverrides,
  type RoiResult,
} from "~/lib/roi/computeRoi";
import {
  estimateMonthlyCalls,
  TRADES,
  type TradeKey,
} from "~/lib/roi/roiModel";
import {
  FOLLOWUP_IDS_BY_DIMENSION,
  INITIAL_ASK_ORDER,
  RESPOND_QUESTION_IDS,
  SCREENING_IDS_BY_DIMENSION,
  type AssessmentDimension,
} from "./questions";

export type SeverityBand = "Low" | "Moderate" | "High";
export type Confidence = "High" | "Medium" | "Low";
export type SeverityStatus = "scored" | "needs_clarification";
export type FieldSource = "modeled" | "visitor_provided";
export type AnswerValue = 0 | 1 | 2 | 3 | "not_sure";

export type ResolvedRespondField = {
  value: number;
  source: FieldSource;
  defaultValue: number;
  explicitlyMarkedNotSure: boolean;
};

export type DimensionSeverityResult =
  | {
      status: "scored";
      score: number;
      band: SeverityBand;
      confidence: Confidence;
    }
  | {
      status: "needs_clarification";
      confidence: Confidence;
    };

export type RespondSeverityResult =
  | {
      status: "scored";
      score: number;
      band: SeverityBand;
      confidence: Confidence;
    }
  | {
      status: "needs_clarification";
      confidence: Confidence;
    };

export type PriorityDimension = {
  key: AssessmentDimension | "Respond";
  label: string;
  status: SeverityStatus;
  band?: SeverityBand;
  score?: number;
  confidence: Confidence;
};

export type PriorityOrderResult = {
  rankedGroups: PriorityDimension[][];
  clarifyGroup: PriorityDimension[];
};

export type CalculatorDefaults = {
  monthlyCalls: number;
  missedCallRatePct: number;
  avgJobValue: number;
};

export type RespondInputs = {
  R1: ResolvedRespondField;
  R2: ResolvedRespondField;
  R3: ResolvedRespondField;
  label: string;
};

export type VisitorRespondEdits = {
  monthlyCalls?: number | "not_sure";
  missedCallRatePct?: number | "not_sure";
  avgJobValue?: number | "not_sure";
};

const READINESS_RANK: Record<AssessmentDimension | "Respond", number> = {
  GF: 6,
  Respond: 5,
  CV: 4,
  RG: 3,
  RM: 2,
  MI: 1,
};

const BAND_RANK: Record<SeverityBand, number> = {
  High: 3,
  Moderate: 2,
  Low: 1,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function roundHalfUp(value: number): number {
  if (value >= 0) {
    return Math.floor(value + 0.5);
  }
  return Math.ceil(value - 0.5);
}

export function bandOf(score: number): SeverityBand {
  if (score <= 33) return "Low";
  if (score <= 66) return "Moderate";
  return "High";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getCalculatorDefaults(
  trade: TradeKey,
  truckCount: number,
): CalculatorDefaults {
  return {
    monthlyCalls: estimateMonthlyCalls(trade, truckCount),
    missedCallRatePct: TRADES[trade].missedCallRate * 100,
    avgJobValue: TRADES[trade].avgJobValue,
  };
}

export function resolveRespondField(
  defaultValue: number,
  visitorEdit: number | "not_sure" | undefined,
): ResolvedRespondField {
  if (isUsableNumber(visitorEdit)) {
    return {
      value: visitorEdit,
      source: "visitor_provided",
      defaultValue,
      explicitlyMarkedNotSure: false,
    };
  }

  return {
    value: defaultValue,
    source: "modeled",
    defaultValue,
    explicitlyMarkedNotSure: visitorEdit === "not_sure",
  };
}

export function resolveRespondInputs(
  defaults: CalculatorDefaults,
  visitorEdits: VisitorRespondEdits = {},
): RespondInputs {
  const R1 = resolveRespondField(defaults.monthlyCalls, visitorEdits.monthlyCalls);
  const R2 = resolveRespondField(
    defaults.missedCallRatePct,
    visitorEdits.missedCallRatePct,
  );
  const R3 = resolveRespondField(defaults.avgJobValue, visitorEdits.avgJobValue);

  const sources = [R1.source, R2.source, R3.source];
  const allModeled = sources.every((source) => source === "modeled");
  const allVisitorProvided = sources.every(
    (source) => source === "visitor_provided",
  );

  const label = allModeled
    ? "Estimate based on your business type and size."
    : allVisitorProvided
      ? "Calculated using the numbers you provided."
      : "Calculated using your information and modeled assumptions.";

  return { R1, R2, R3, label };
}

export function respondDollarEstimateOrFallback(
  trade: TradeKey | undefined,
  truckCount: number | undefined,
  R1: ResolvedRespondField,
  R2: ResolvedRespondField,
  R3: ResolvedRespondField,
): { estimate: RoiResult[] | null } {
  if (
    trade == null ||
    truckCount == null ||
    !isUsableNumber(R1.value) ||
    !isUsableNumber(R2.value) ||
    !isUsableNumber(R3.value)
  ) {
    return { estimate: null };
  }

  return {
    estimate: computeAllScenariosWithOverrides(trade, R1.value, {
      missedCallRateOverride: R2.value / 100,
      avgJobValueOverride: R3.value,
    }),
  };
}

export function respondSeverity(R2: ResolvedRespondField): RespondSeverityResult {
  if (!isUsableNumber(R2.value)) {
    return { status: "needs_clarification", confidence: "Low" };
  }

  const pct = R2.value;
  const band: SeverityBand =
    pct <= 10 ? "Low" : pct <= 20 ? "Moderate" : "High";
  const confidence: Confidence =
    R2.source === "visitor_provided" ? "High" : "Low";
  const score = Math.min(100, roundHalfUp((pct / 30) * 100));

  return { status: "scored", score, band, confidence };
}

export type DimensionSeverityCore =
  | { status: "scored"; score: number; band: SeverityBand }
  | { status: "needs_clarification" };

export function dimensionSeverity(
  screeningScore: number | "not_sure",
  usableFollowUpScores: number[],
): DimensionSeverityCore {
  if (screeningScore === "not_sure" && usableFollowUpScores.length === 1) {
    const raw = usableFollowUpScores[0]! / 2;
    const score = Math.round(raw * 100);
    return { status: "scored", score, band: bandOf(score) };
  }

  if (screeningScore === "not_sure" && usableFollowUpScores.length === 0) {
    return { status: "needs_clarification" };
  }

  const numerator =
    (typeof screeningScore === "number" ? screeningScore : 0) +
    usableFollowUpScores.reduce((sum, score) => sum + score, 0);
  const denominator =
    usableFollowUpScores.length === 0
      ? 3
      : 3 + 2 * usableFollowUpScores.length;
  const raw =
    usableFollowUpScores.length === 0
      ? (screeningScore as number) / 3
      : numerator / denominator;
  const score = roundHalfUp(raw * 100);

  return { status: "scored", score, band: bandOf(score) };
}

export function confidence(
  screeningScore: number | "not_sure" | undefined,
  usableFollowUpScores: number[],
  unavailableApplicableCount: number,
  hasNotSureApplicableAnswer: boolean,
): Confidence {
  if (screeningScore === "not_sure") return "Low";
  if (unavailableApplicableCount >= 2) return "Low";
  if (
    screeningScore == null ||
    hasNotSureApplicableAnswer
  ) {
    return "Medium";
  }

  const normScreen = screeningScore / 3;
  const normFollowAvg = average(usableFollowUpScores) / 2;
  if (Math.abs(normScreen - normFollowAvg) >= 0.5) {
    return "Medium";
  }

  return "High";
}

export function scoreDimension(
  screeningScore: number | "not_sure" | undefined,
  usableFollowUpScores: number[],
  unavailableApplicableCount: number,
  hasNotSureApplicableAnswer: boolean,
): DimensionSeverityResult {
  const severity = dimensionSeverity(
    screeningScore ?? "not_sure",
    usableFollowUpScores,
  );

  if (severity.status === "needs_clarification") {
    return { status: "needs_clarification", confidence: "Low" };
  }

  const scored = severity as Extract<
    DimensionSeverityCore,
    { status: "scored" }
  >;

  return {
    status: "scored",
    score: scored.score,
    band: scored.band,
    confidence: confidence(
      screeningScore,
      usableFollowUpScores,
      unavailableApplicableCount,
      hasNotSureApplicableAnswer,
    ),
  };
}

function sortKey(dimension: PriorityDimension): [
  number,
  number,
  number,
  number,
  number,
] {
  return [
    BAND_RANK[dimension.band ?? "Low"],
    dimension.score ?? 0,
    CONFIDENCE_RANK[dimension.confidence],
    0,
    READINESS_RANK[dimension.key],
  ];
}

function groupKey(dimension: PriorityDimension): [number, number, number] {
  return [
    BAND_RANK[dimension.band ?? "Low"],
    dimension.score ?? 0,
    CONFIDENCE_RANK[dimension.confidence],
  ];
}

function groupKeysEqual(
  left: ReturnType<typeof groupKey>,
  right: ReturnType<typeof groupKey>,
): boolean {
  return left.every((value, index) => value === right[index]);
}

export function priorityOrder(
  dimensions: PriorityDimension[],
): PriorityOrderResult {
  const rankable = dimensions.filter(
    (dimension) => dimension.status === "scored",
  );
  const clarifyGroup = dimensions.filter(
    (dimension) => dimension.status === "needs_clarification",
  );

  const sorted = [...rankable].sort((left, right) => {
    const leftKey = sortKey(left);
    const rightKey = sortKey(right);
    for (let index = 0; index < leftKey.length; index += 1) {
      if (rightKey[index]! !== leftKey[index]!) {
        return rightKey[index]! - leftKey[index]!;
      }
    }
    return 0;
  });

  const rankedGroups: PriorityDimension[][] = [];
  for (const dimension of sorted) {
    const currentGroupKey = groupKey(dimension);
    const lastGroup = rankedGroups.at(-1);
    if (
      lastGroup &&
      groupKeysEqual(groupKey(lastGroup[0]!), currentGroupKey)
    ) {
      lastGroup.push(dimension);
    } else {
      rankedGroups.push([dimension]);
    }
  }

  return { rankedGroups, clarifyGroup };
}

export function firstNFollowUpIds(
  dimension: AssessmentDimension,
  count: number,
): string[] {
  return FOLLOWUP_IDS_BY_DIMENSION[dimension].slice(0, count);
}

export class AssessmentEngine {
  readonly activeQuestionIds = new Set<string>(INITIAL_ASK_ORDER);
  readonly answers = new Map<string, AnswerValue>();

  getActiveQuestionIds(): string[] {
    return [...this.activeQuestionIds];
  }

  setAnswer(questionId: string, value: AnswerValue): void {
    this.answers.set(questionId, value);
  }

  onScreeningAnswered(
    dimension: AssessmentDimension,
    score: AnswerValue,
  ): void {
    this.setAnswer(SCREENING_IDS_BY_DIMENSION[dimension], score);

    if (score === 3 || score === 2) {
      this.openFollowUps(dimension, 3);
    } else if (score === 1) {
      this.openFollowUps(dimension, 1);
    } else if (score === "not_sure") {
      this.openFollowUps(dimension, 1);
    }
  }

  openFollowUps(dimension: AssessmentDimension, count: number): void {
    const ids = firstNFollowUpIds(dimension, count);
    for (const id of ids) {
      this.activeQuestionIds.add(id);
    }
    if (this.activeQuestionIds.size > 25) {
      throw new Error("Assessment active question IDs exceeded 25");
    }
  }

  onScreeningChanged(
    dimension: AssessmentDimension,
    newScore: AnswerValue,
  ): void {
    for (const followUpId of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
      this.activeQuestionIds.delete(followUpId);
      this.answers.delete(followUpId);
    }
    this.onScreeningAnswered(dimension, newScore);
  }

  getScreeningAnswer(dimension: AssessmentDimension): AnswerValue | undefined {
    return this.answers.get(SCREENING_IDS_BY_DIMENSION[dimension]);
  }

  getFollowUpAnswers(dimension: AssessmentDimension): AnswerValue[] {
    return FOLLOWUP_IDS_BY_DIMENSION[dimension]
      .filter((id) => this.activeQuestionIds.has(id))
      .map((id) => this.answers.get(id))
      .filter((value): value is AnswerValue => value != null);
  }

  scoreDimension(dimension: AssessmentDimension): DimensionSeverityResult {
    const screeningAnswer = this.getScreeningAnswer(dimension);
    const activeFollowUps = FOLLOWUP_IDS_BY_DIMENSION[dimension].filter((id) =>
      this.activeQuestionIds.has(id),
    );
    const followUpAnswers = activeFollowUps
      .map((id) => this.answers.get(id))
      .filter((value): value is AnswerValue => value != null);

    const usableFollowUpScores = followUpAnswers.filter(
      (value): value is 0 | 1 | 2 | 3 => typeof value === "number",
    );
    const unavailableApplicableCount = followUpAnswers.filter(
      (value) => value === "not_sure",
    ).length;
    const hasNotSureApplicableAnswer =
      screeningAnswer === "not_sure" ||
      followUpAnswers.some((value) => value === "not_sure");

    return scoreDimension(
      screeningAnswer,
      usableFollowUpScores,
      unavailableApplicableCount,
      hasNotSureApplicableAnswer,
    );
  }
}

export function respondQuestionIds(activeQuestionIds: Iterable<string>): string[] {
  return [...activeQuestionIds].filter((id) =>
    (RESPOND_QUESTION_IDS as readonly string[]).includes(id),
  );
}

export function hasRespondScreeningOrFollowUp(
  activeQuestionIds: Iterable<string>,
): boolean {
  for (const id of activeQuestionIds) {
    if (id.startsWith("R") && id !== "R1" && id !== "R2" && id !== "R3") {
      return true;
    }
  }
  return false;
}
