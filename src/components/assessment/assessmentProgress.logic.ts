import {
  DIMENSION_LABELS,
  type AssessmentDimension,
} from "~/lib/assessment/questions";

const AREA_ORDER: (AssessmentDimension | "Respond")[] = [
  "Respond",
  "GF",
  "CV",
  "RG",
  "RM",
  "MI",
];

/** Respond assumptions only — not Retain (RG) or Reduce Manual Work (RM) question IDs. */
export function isRespondProgressQuestionId(questionId: string): boolean {
  return (
    questionId === "respond" ||
    questionId === "R1" ||
    questionId === "R2" ||
    questionId === "R3"
  );
}

export function areaIndexForQuestion(questionId: string): number {
  if (questionId === "bp1") return 1;
  if (questionId === "bp2") return 2;
  if (isRespondProgressQuestionId(questionId)) {
    return AREA_ORDER.indexOf("Respond") + 1;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  const index = AREA_ORDER.indexOf(prefix);
  return index >= 0 ? index + 1 : AREA_ORDER.indexOf("Respond") + 1;
}

export function areaLabelForQuestion(questionId: string): string {
  if (questionId === "bp1") return "Trade";
  if (questionId === "bp2") return "Fleet size";
  if (isRespondProgressQuestionId(questionId)) {
    return DIMENSION_LABELS.Respond;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  return DIMENSION_LABELS[prefix] ?? DIMENSION_LABELS.Respond;
}
