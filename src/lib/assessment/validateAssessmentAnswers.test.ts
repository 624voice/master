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

describe("validateAssessmentAnswers supplemental", () => {
  test("S-VAL-01: rejects unknown answer fields", () => {
    const result = validateAssessmentAnswers({
      ...validAnswers,
      mysteryField: "nope",
    });

    expect(result).toMatchObject({
      error: "Unknown assessment answer fields",
      unknownFields: ["mysteryField"],
    });
  });

  test("S-VAL-02: accepts known valid answers", () => {
    const result = validateAssessmentAnswers(validAnswers);

    expect(result).not.toHaveProperty("error");
    if ("answers" in result) {
      expect(result.answers.BP1).toBe("HVAC");
      expect(result.answers["GF-S"]).toBe(2);
      expect(result.unknownFields).toEqual([]);
    }
  });

  test("S-VAL-03: validates business_profile string answers", () => {
    const empty = validateAssessmentAnswers({ ...validAnswers, BP1: "  " });
    expect(empty).toMatchObject({
      error: "Invalid answer value for BP1",
      unknownFields: [],
    });

    const ok = validateAssessmentAnswers({ ...validAnswers, BP1: "Plumbers" });
    expect(ok).not.toHaveProperty("error");
    if ("answers" in ok) {
      expect(ok.answers.BP1).toBe("Plumbers");
    }
  });

  test("S-VAL-04: validates respond numeric and not_sure answers", () => {
    const numeric = validateAssessmentAnswers({ ...validAnswers, R1: 120 });
    expect(numeric).not.toHaveProperty("error");
    if ("answers" in numeric) {
      expect(numeric.answers.R1).toBe(120);
    }

    const notSure = validateAssessmentAnswers({ ...validAnswers, R2: "not_sure" });
    expect(notSure).not.toHaveProperty("error");
    if ("answers" in notSure) {
      expect(notSure.answers.R2).toBe("not_sure");
    }

    const invalid = validateAssessmentAnswers({ ...validAnswers, R3: "lots" });
    expect(invalid).toMatchObject({
      error: "Invalid answer value for R3",
      unknownFields: [],
    });
  });

  test("S-VAL-05: accepts positive finite truckCount", () => {
    const result = validateAssessmentAnswers({ ...validAnswers, truckCount: 7 });

    expect(result).not.toHaveProperty("error");
    if ("answers" in result) {
      expect(result.answers.truckCount).toBe(7);
    }
  });

  test("S-VAL-06: rejects invalid truckCount values", () => {
    expect(validateAssessmentAnswers({ ...validAnswers, truckCount: 0 })).toMatchObject({
      error: "Invalid truckCount",
      unknownFields: [],
    });
    expect(
      validateAssessmentAnswers({ ...validAnswers, truckCount: -3 }),
    ).toMatchObject({
      error: "Invalid truckCount",
      unknownFields: [],
    });
    expect(
      validateAssessmentAnswers({ ...validAnswers, truckCount: "seven" }),
    ).toMatchObject({
      error: "Invalid truckCount",
      unknownFields: [],
    });
  });
});
