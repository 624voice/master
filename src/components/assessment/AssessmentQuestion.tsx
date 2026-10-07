import {
  FLEET_SIZE_LABELS,
  FLEET_SIZE_RANGES,
  type FleetSizeRange,
} from "~/lib/lead/validateLead";
import { getTradeKeys, TRADES } from "~/lib/roi/callVolume";
import type { AnswerValue } from "~/lib/assessment/engine";
import type { AssessmentQuestion as AssessmentQuestionDef } from "~/lib/assessment/questions";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const choiceButtonClass = (selected: boolean) =>
  `w-full rounded-lg border px-4 py-3 text-left text-sm transition-all ${
    selected
      ? "border-brand-primary bg-brand-primary-light/60 font-semibold text-brand-secondary ring-2 ring-brand-primary/20"
      : "border-gray-200 bg-white text-gray-700 hover:border-brand-primary/40 hover:bg-gray-50"
  }`;

type AssessmentQuestionProps = {
  question: AssessmentQuestionDef;
  value: AnswerValue | string | undefined;
  onChange: (value: AnswerValue | string) => void;
};

export function AssessmentQuestion({
  question,
  value,
  onChange,
}: AssessmentQuestionProps) {
  if (question.type === "business_profile" && question.id === "BP1") {
    return (
      <div>
        <label
          htmlFor="assessment-bp1"
          className="block text-sm font-bold text-brand-secondary"
        >
          {question.text}
        </label>
        <select
          id="assessment-bp1"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
          required
        >
          <option value="">Choose a trade…</option>
          {getTradeKeys().map((key) => (
            <option key={key} value={key}>
              {TRADES[key].label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === "business_profile" && question.id === "BP2") {
    return (
      <div>
        <label
          htmlFor="assessment-bp2"
          className="block text-sm font-bold text-brand-secondary"
        >
          {question.text}
        </label>
        <select
          id="assessment-bp2"
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value as FleetSizeRange)
          }
          className={inputClassName}
          required
        >
          <option value="">Select fleet size…</option>
          {FLEET_SIZE_RANGES.map((range) => (
            <option key={range} value={range}>
              {FLEET_SIZE_LABELS[range]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const selectedScore = typeof value === "number" ? value : null;
  const isNotSure = value === "not_sure";

  return (
    <fieldset>
      <legend className="block text-base font-bold text-brand-secondary">
        {question.text}
      </legend>
      <div className="mt-4 space-y-2">
        {question.choices.map((choice) => (
          <button
            key={choice.score}
            type="button"
            onClick={() => onChange(choice.score)}
            className={choiceButtonClass(selectedScore === choice.score)}
            aria-pressed={selectedScore === choice.score}
          >
            {choice.label}
          </button>
        ))}
        {question.supportsNotSure && (
          <button
            type="button"
            onClick={() => onChange("not_sure")}
            className={choiceButtonClass(isNotSure)}
            aria-pressed={isNotSure}
          >
            Not sure
          </button>
        )}
      </div>
    </fieldset>
  );
}
