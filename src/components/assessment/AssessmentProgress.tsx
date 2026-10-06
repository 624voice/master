import {
  areaIndexForQuestion,
  areaLabelForQuestion,
} from "./assessmentProgress.logic";

export { areaIndexForQuestion, areaLabelForQuestion } from "./assessmentProgress.logic";

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
          ? "Setup only — trade and fleet size before the six-area assessment"
          : "Screening and follow-up questions"}
      </p>
    </div>
  );
}
