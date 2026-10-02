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
  if (questionId === "bp1" || questionId === "bp2") {
    return 0;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  const index = AREA_ORDER.indexOf(prefix);
  return index >= 0 ? index + 1 : 1;
}

export function areaLabelForQuestion(questionId: string): string {
  if (questionId === "bp1") return "Trade";
  if (questionId === "bp2") return "Fleet size";
  if (questionId === "respond" || questionId.startsWith("R")) {
    return DIMENSION_LABELS.Respond;
  }
  const prefix = questionId.split("-")[0] as AssessmentDimension;
  return DIMENSION_LABELS[prefix] ?? DIMENSION_LABELS.Respond;
}

type AssessmentProgressProps = {
  questionId: string;
  stepKey?: string;
};

export function AssessmentProgress({ questionId, stepKey }: AssessmentProgressProps) {
  const isSetup = questionId === "bp1" || questionId === "bp2";
  const areaIndex = isSetup
    ? questionId === "bp1"
      ? 1
      : 2
    : areaIndexForQuestion(questionId);
  const totalSteps = isSetup ? 2 : 6;
  const areaLabel = areaLabelForQuestion(questionId);

  const label = isSetup
    ? `Setup step ${areaIndex} of ${totalSteps} — ${areaLabel}`
    : `Step ${areaIndex} of ${totalSteps} areas — ${areaLabel}`;

  return (
    <div
      className="rounded-lg border-2 border-brand-secondary/20 bg-white px-4 py-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-sm font-semibold text-brand-secondary">
        <span className="sr-only">Assessment progress: </span>
        {label}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-600" aria-hidden="true">
        {stepKey === "bp1" || stepKey === "bp2"
          ? "Trade and fleet size"
          : "Screening and follow-up questions"}
      </p>
    </div>
  );
}
