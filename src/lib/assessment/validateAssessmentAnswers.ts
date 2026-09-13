import { ALL_QUESTION_IDS } from "./questions";
import type { AnswerValue } from "./engine";

const KNOWN_ANSWER_KEYS = new Set<string>([
  ...ALL_QUESTION_IDS,
  "trade",
  "truckCount",
  "fleetSize",
]);

export type AssessmentAnswersInput = Record<string, unknown>;

export type ValidatedAssessmentAnswers = {
  answers: Record<string, AnswerValue | string | number>;
  unknownFields: string[];
};

function isAnswerValue(value: unknown): value is AnswerValue {
  return (
    value === "not_sure" ||
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3
  );
}

export function validateAssessmentAnswers(
  raw: AssessmentAnswersInput,
): ValidatedAssessmentAnswers | { error: string; unknownFields: string[] } {
  const unknownFields = Object.keys(raw).filter(
    (key) => !KNOWN_ANSWER_KEYS.has(key),
  );

  if (unknownFields.length > 0) {
    return {
      error: "Unknown assessment answer fields",
      unknownFields,
    };
  }

  const answers: Record<string, AnswerValue | string | number> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (ALL_QUESTION_IDS.includes(key)) {
      if (!isAnswerValue(value)) {
        return {
          error: `Invalid answer value for ${key}`,
          unknownFields: [],
        };
      }
      answers[key] = value;
      continue;
    }

    if (key === "trade" || key === "fleetSize") {
      if (typeof value !== "string" || value.trim().length === 0) {
        return {
          error: `Invalid value for ${key}`,
          unknownFields: [],
        };
      }
      answers[key] = value;
      continue;
    }

    if (key === "truckCount") {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return {
          error: "Invalid truckCount",
          unknownFields: [],
        };
      }
      answers[key] = value;
    }
  }

  return { answers, unknownFields: [] };
}
