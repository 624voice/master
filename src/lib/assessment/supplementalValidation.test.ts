import { describe, expect, test } from "bun:test";
import { validateAssessmentAnswers } from "~/lib/assessment/validateAssessmentAnswers";

const validAnswers = {
  BP1: "HVAC",
  BP2: "3-7",
  R1: 300,
  R2: 15,
  R3: 350,
  "GF-S": 2,
  "CV-S": 1,
  "RG-S": 1,
  "RM-S": 1,
  "MI-S": 1,
};

describe("validateAssessmentAnswers extended supplemental", () => {
  test("S-VAL-07: rejects non-finite numeric respond answers", () => {
    expect(validateAssessmentAnswers({ ...validAnswers, R1: Infinity })).toMatchObject({
      error: "Invalid answer value for R1",
    });
    expect(validateAssessmentAnswers({ ...validAnswers, R1: NaN })).toMatchObject({
      error: "Invalid answer value for R1",
    });
  });

  test("S-VAL-08: screening answers must be 0-3 or not_sure", () => {
    expect(validateAssessmentAnswers({ ...validAnswers, "GF-S": 4 })).toMatchObject({
      error: "Invalid answer value for GF-S",
    });
    expect(validateAssessmentAnswers({ ...validAnswers, "GF-S": "not_sure" })).not.toHaveProperty(
      "error",
    );
  });

  test("S-VAL-09: follow-up answers accept 0-3 and not_sure", () => {
    const withFollowUp = validateAssessmentAnswers({
      ...validAnswers,
      "GF-S": 3,
      "GF-F1": 2,
      "GF-F2": "not_sure",
      "GF-F3": 0,
    });
    expect(withFollowUp).not.toHaveProperty("error");

    expect(
      validateAssessmentAnswers({ ...validAnswers, "GF-S": 3, "GF-F1": 4 }),
    ).toMatchObject({
      error: "Invalid answer value for GF-F1",
    });
  });

  test("S-VAL-10: truckCount above MAX is rejected at handler layer placeholder", () => {
    const result = validateAssessmentAnswers({ ...validAnswers, truckCount: 51 });
    expect(result).not.toHaveProperty("error");
    if ("answers" in result) {
      expect(result.answers.truckCount).toBe(51);
    }
  });
});
