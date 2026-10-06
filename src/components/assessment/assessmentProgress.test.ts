import { describe, expect, test } from "bun:test";
import { AssessmentEngine } from "~/lib/assessment/engine";
import { buildQuestionFlow } from "~/lib/assessment/assessmentFlowController";
import {
  areaIndexForQuestion,
  areaLabelForQuestion,
} from "./assessmentProgress.logic";

describe("Assessment progress identity (Checkpoint 1 regression)", () => {
  test("RG and RM question IDs are not misclassified as Respond", () => {
    expect(areaLabelForQuestion("RG-S")).toBe("Retain and Grow");
    expect(areaLabelForQuestion("RG-F1")).toBe("Retain and Grow");
    expect(areaLabelForQuestion("RM-S")).toBe("Reduce Manual Work");
    expect(areaLabelForQuestion("RM-F2")).toBe("Reduce Manual Work");
    expect(areaLabelForQuestion("respond")).toBe("Respond");
    expect(areaLabelForQuestion("R2")).toBe("Respond");
  });

  test("step numbering does not move backward from Convert to Retain", () => {
    const cvIndex = areaIndexForQuestion("CV-S");
    const rgIndex = areaIndexForQuestion("RG-S");
    expect(rgIndex).toBeGreaterThan(cvIndex);
    expect(areaIndexForQuestion("RG-F1")).toBe(rgIndex);
  });

  test("severity 2/3 opens follow-ups in question flow order", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.onScreeningAnswered("CV", 2);
    const flow = buildQuestionFlow(engine);
    expect(flow).toEqual([
      "GF-S",
      "GF-F1",
      "GF-F2",
      "GF-F3",
      "CV-S",
      "CV-F1",
      "CV-F2",
      "CV-F3",
      "RG-S",
      "RM-S",
      "MI-S",
    ]);
    expect(areaLabelForQuestion(flow[4]!)).toBe("Convert");
    expect(areaLabelForQuestion(flow[8]!)).toBe("Retain and Grow");
  });
});
