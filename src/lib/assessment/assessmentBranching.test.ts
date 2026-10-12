import { describe, expect, test } from "bun:test";
import { AssessmentEngine } from "./engine";
import {
  buildQuestionFlow,
  flowStepBack,
  resolveBackQuestionIndex,
} from "./assessmentFlowController";
import {
  FOLLOWUP_IDS_BY_DIMENSION,
  SCREENING_IDS_BY_DIMENSION,
  type AssessmentDimension,
} from "./questions";
import {
  areaLabelForQuestion,
  isRespondProgressQuestionId,
} from "~/components/assessment/assessmentProgress.logic";

const SCORED: AssessmentDimension[] = ["GF", "CV", "RG", "RM", "MI"];

/** UI severity-3 (weakest): choice score 0 — "Not at all / rarely". */
const SEVERITY3_DEFICIT = 0 as const;
/** UI severity-2 (partial): choice score 2 — "Mostly / often". */
const SEVERITY2_PARTIAL = 2 as const;
/** UI severity-1 (healthy): choice score 3 — "Consistently / always". */
const SEVERITY1_HEALTHY = 3 as const;

function firstFollowUp(dimension: AssessmentDimension): string {
  return FOLLOWUP_IDS_BY_DIMENSION[dimension][0]!;
}

describe("Assessment screening branch matrix (Checkpoint 1 corrective)", () => {
  for (const dimension of SCORED) {
    test(`${dimension} severity-2 (score 2) opens three follow-ups under same dimension`, () => {
      const engine = new AssessmentEngine();
      engine.onScreeningAnswered(dimension, SEVERITY2_PARTIAL);
      for (const id of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
        expect(engine.getActiveQuestionIds()).toContain(id);
      }
      const flow = buildQuestionFlow(engine);
      const screeningId = SCREENING_IDS_BY_DIMENSION[dimension];
      expect(flow.indexOf(screeningId)).toBeGreaterThanOrEqual(0);
      expect(flow.indexOf(firstFollowUp(dimension))).toBe(flow.indexOf(screeningId) + 1);
    });

    test(`${dimension} severity-3 (score 0) opens three follow-ups under same dimension`, () => {
      const engine = new AssessmentEngine();
      engine.onScreeningAnswered(dimension, SEVERITY3_DEFICIT);
      for (const id of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
        expect(engine.getActiveQuestionIds()).toContain(id);
      }
      const flow = buildQuestionFlow(engine);
      const screeningId = SCREENING_IDS_BY_DIMENSION[dimension];
      expect(flow).toContain(firstFollowUp(dimension));
      expect(flow.indexOf(firstFollowUp(dimension))).toBe(flow.indexOf(screeningId) + 1);
    });

    test(`${dimension} severity-1 healthy (score 3) does not open follow-ups`, () => {
      const engine = new AssessmentEngine();
      engine.onScreeningAnswered(dimension, SEVERITY1_HEALTHY);
      for (const id of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
        expect(engine.getActiveQuestionIds()).not.toContain(id);
      }
    });
  }

  test("Get Found severity-3 literal: GF-S score 0 then GF-F1 before CV-S", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", SEVERITY3_DEFICIT);
    const flow = buildQuestionFlow(engine);
    expect(flow.slice(0, 5)).toEqual(["GF-S", "GF-F1", "GF-F2", "GF-F3", "CV-S"]);
    expect(areaLabelForQuestion("GF-F1")).toBe("Get Found");
  });

  test("Get Found severity-2 literal: GF-S score 2 then GF-F1 before CV-S", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", SEVERITY2_PARTIAL);
    const flow = buildQuestionFlow(engine);
    expect(flow[0]).toBe("GF-S");
    expect(flow[1]).toBe("GF-F1");
    expect(flow[4]).toBe("CV-S");
  });

  test("Convert severity-3 literal: flow places CV follow-up before RG-S", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", SEVERITY1_HEALTHY);
    engine.onScreeningAnswered("CV", SEVERITY3_DEFICIT);
    const flow = buildQuestionFlow(engine);
    const cvScreen = flow.indexOf("CV-S");
    const cvFollow = flow.indexOf("CV-F1");
    const rgScreen = flow.indexOf("RG-S");
    expect(cvFollow).toBe(cvScreen + 1);
    expect(rgScreen).toBeGreaterThan(cvFollow);
    expect(areaLabelForQuestion("CV-F1")).toBe("Convert");
  });

  test("severity-2 to severity-3 on same dimension replaces branch and clears stale follow-up answers", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", SEVERITY2_PARTIAL);
    engine.setAnswer("GF-F1", 2);
    engine.onScreeningChanged("GF", SEVERITY3_DEFICIT);
    expect(engine.getActiveQuestionIds()).toContain("GF-F1");
    expect(engine.answers.get("GF-F1")).toBeUndefined();
    engine.setAnswer("GF-F1", 1);
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
  });

  test("severity-3 to severity-2 on same dimension replaces branch cleanly", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("RG", SEVERITY3_DEFICIT);
    engine.setAnswer("RG-F1", 0);
    engine.onScreeningChanged("RG", SEVERITY2_PARTIAL);
    expect(engine.answers.get("RG-F1")).toBeUndefined();
    expect(engine.getActiveQuestionIds()).toContain("RG-F3");
  });

  test("back from first question after GF severity-3 returns to respond step", () => {
    const back = flowStepBack("questions", 0);
    expect(back).toEqual({ step: "respond", questionIndex: 0 });
  });

  test("forward navigation preserves screening and follow-up answers in engine state", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", SEVERITY3_DEFICIT);
    engine.setAnswer("GF-F1", 1);
    expect(engine.getScreeningAnswer("GF")).toBe(0);
    expect(engine.answers.get("GF-F1")).toBe(1);
    const flow = buildQuestionFlow(engine);
    expect(flow[2]).toBe("GF-F2");
  });

  test("Respond progress ids exclude RG and RM question ids", () => {
    expect(isRespondProgressQuestionId("respond")).toBe(true);
    expect(isRespondProgressQuestionId("R2")).toBe(true);
    expect(isRespondProgressQuestionId("RG-F1")).toBe(false);
    expect(isRespondProgressQuestionId("RM-S")).toBe(false);
    expect(areaLabelForQuestion("RM-F2")).toBe("Reduce Manual Work");
  });

  test("resolveBackQuestionIndex maps MAX_SAFE_INTEGER to last flow slot", () => {
    const engine = new AssessmentEngine();
    for (const dimension of SCORED) {
      engine.onScreeningAnswered(
        dimension,
        dimension === "GF" ? SEVERITY3_DEFICIT : SEVERITY1_HEALTHY,
      );
    }
    const flow = buildQuestionFlow(engine);
    const lastIndex = resolveBackQuestionIndex(engine, Number.MAX_SAFE_INTEGER);
    expect(flow[lastIndex]).toBe("MI-S");
    expect(flow.indexOf("GF-F1")).toBe(1);
  });
});
