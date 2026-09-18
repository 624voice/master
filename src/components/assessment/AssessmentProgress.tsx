import { DIMENSION_LABELS, type AssessmentDimension } from "~/lib/assessment/questions";

const AREA_ORDER: (AssessmentDimension | "Respond")[] = [
  "Respond",
  "GF",
  "CV",
  "RG",
  "RM",
  "MI",
];

export function areaIndexForQuestion(questionId: string): number {
  if (questionId === "respond" || questionId.startsWith("R")) {
    return 1;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  const index = AREA_ORDER.indexOf(prefix);
  return index >= 0 ? index + 1 : 1;
}

export function areaLabelForQuestion(questionId: string): string {
  if (questionId === "respond" || questionId.startsWith("R")) {
    return DIMENSION_LABELS.Respond;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  return DIMENSION_LABELS[prefix] ?? DIMENSION_LABELS.Respond;
}

type AssessmentProgressProps = {
  questionId: string;
};

export function AssessmentProgress({ questionId }: AssessmentProgressProps) {
  const areaIndex = areaIndexForQuestion(questionId);
  const areaLabel = areaLabelForQuestion(questionId);

  return (
    <p
      className="text-sm font-medium text-brand-accent"
      aria-live="polite"
      aria-atomic="true"
    >
      Step {areaIndex} of six areas — {areaLabel}
    </p>
  );
}
