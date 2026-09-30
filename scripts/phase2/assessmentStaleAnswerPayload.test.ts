/**
 * Executable proof: lowering GF-S removes stale GF-F1/F2/F3 from engine state.
 * Complements owner walkthrough rendered-absence check.
 */
import { describe, expect, test } from "bun:test";
import { AssessmentEngine } from "../../src/lib/assessment/engine";

describe("assessment stale follow-up payload removal", () => {
  test("X-SAFE-PREVIEW-FOCUS-03: onScreeningChanged clears GF-F1/F2/F3 answers from active state", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 2);
    engine.setAnswer("GF-F2", 1);
    engine.setAnswer("GF-F3", 0);

    expect(engine.getActiveQuestionIds()).toEqual(
      expect.arrayContaining(["GF-F1", "GF-F2", "GF-F3"]),
    );
    expect(engine.answers.get("GF-F1")).toBe(2);

    engine.onScreeningChanged("GF", 0);

    expect(engine.getActiveQuestionIds()).not.toContain("GF-F1");
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F2");
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F3");
    expect(engine.answers.has("GF-F1")).toBe(false);
    expect(engine.answers.has("GF-F2")).toBe(false);
    expect(engine.answers.has("GF-F3")).toBe(false);
  });
});
