import { describe, expect, test } from "bun:test";
import {
  AssessmentEngine,
  bandOf,
  confidence,
  dimensionSeverity,
  getCalculatorDefaults,
  priorityOrder,
  respondDollarEstimateOrFallback,
  respondSeverity,
  resolveRespondField,
  resolveRespondInputs,
  roundHalfUp,
  scoreDimension,
  type PriorityDimension,
  type ResolvedRespondField,
} from "./engine";
import { ASSESSMENT_QUESTIONS, RESPOND_QUESTION_IDS } from "./questions";
import { runAssessment } from "./runAssessment";

function scoredDimension(
  key: PriorityDimension["key"],
  score: number,
  band: PriorityDimension["band"],
  confidenceLevel: PriorityDimension["confidence"],
): PriorityDimension {
  return {
    key,
    label: key,
    status: "scored",
    score,
    band,
    confidence: confidenceLevel,
  };
}

describe("L#1 screening 0, no follow-ups", () => {
  test("score 0, Low band", () => {
    const result = dimensionSeverity(0, []);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(0);
      expect(result.band).toBe("Low");
    }
  });
});

describe("L#2 screening 1, no usable follow-ups", () => {
  test("score 33, Low band", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 1);
    engine.setAnswer("GF-F1", "not_sure");
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(33);
      expect(result.band).toBe("Low");
    }
  });
});

describe("L#3 screening 2, no usable follow-ups", () => {
  test("score 67, High band", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 2);
    for (const id of ["GF-F1", "GF-F2", "GF-F3"]) {
      engine.setAnswer(id, "not_sure");
    }
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(67);
      expect(result.band).toBe("High");
    }
  });
});

describe("L#4 screening 3, follow-ups [0,0,0]", () => {
  test("score 33, Low band, Medium confidence", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 0);
    engine.setAnswer("GF-F2", 0);
    engine.setAnswer("GF-F3", 0);
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(33);
      expect(result.band).toBe("Low");
      expect(result.confidence).toBe("Medium");
    }
  });
});

describe("L#5 screening 3, follow-ups [2,2,2]", () => {
  test("score 100, High band, High confidence", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 2);
    engine.setAnswer("GF-F2", 2);
    engine.setAnswer("GF-F3", 2);
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(100);
      expect(result.band).toBe("High");
      expect(result.confidence).toBe("High");
    }
  });
});

describe("L#6 screening 2, follow-ups [0,1,2]", () => {
  test("score 56, Moderate band", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 2);
    engine.setAnswer("GF-F1", 0);
    engine.setAnswer("GF-F2", 1);
    engine.setAnswer("GF-F3", 2);
    const result = engine.scoreDimension("GF");
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(56);
      expect(result.band).toBe("Moderate");
    }
  });
});

describe("L#7 not sure screening, clarification 0", () => {
  test("score 0, Low confidence", () => {
    const result = scoreDimension("not_sure", [0], 0, true);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(0);
      expect(result.confidence).toBe("Low");
    }
  });
});

describe("L#8 not sure screening, clarification 1", () => {
  test("score 50, Low confidence", () => {
    const result = scoreDimension("not_sure", [1], 0, true);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(50);
      expect(result.confidence).toBe("Low");
    }
  });
});

describe("L#9 not sure screening, clarification 2", () => {
  test("score 100, Low confidence", () => {
    const result = scoreDimension("not_sure", [2], 0, true);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBe(100);
      expect(result.confidence).toBe("Low");
    }
  });
});

describe("L#10 not sure screening, clarification not sure", () => {
  test("needs_clarification, Low confidence, no numeric rank", () => {
    const result = scoreDimension("not_sure", [], 1, true);
    expect(result.status).toBe("needs_clarification");
    expect(result.confidence).toBe("Low");
    expect("score" in result).toBe(false);
  });
});

describe("L#11 boundaries 33/34/66/67", () => {
  test("exact band transitions", () => {
    expect(bandOf(33)).toBe("Low");
    expect(bandOf(34)).toBe("Moderate");
    expect(bandOf(66)).toBe("Moderate");
    expect(bandOf(67)).toBe("High");
  });
});

describe("L#12 screening changed after follow-ups", () => {
  test("stale follow-up answers and IDs removed", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 2);
    engine.setAnswer("GF-F2", 2);
    engine.setAnswer("GF-F3", 2);
    expect(engine.getActiveQuestionIds()).toContain("GF-F1");

    engine.onScreeningChanged("GF", 0);
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F1");
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F2");
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F3");
    expect(engine.getFollowUpAnswers("GF")).toEqual([]);
  });
});

describe("L#13 identical band+score+confidence", () => {
  test("grouped together, not force-ranked", () => {
    const dimensions = [
      scoredDimension("GF", 56, "Moderate", "High"),
      scoredDimension("CV", 56, "Moderate", "High"),
      scoredDimension("RG", 33, "Low", "Medium"),
    ];
    const { rankedGroups } = priorityOrder(dimensions);
    expect(rankedGroups[0]).toHaveLength(2);
    expect(rankedGroups[0]!.map((d) => d.key).sort()).toEqual(["CV", "GF"]);
    expect(rankedGroups[1]).toHaveLength(1);
  });
});

describe("L#14 Respond never gets screening/conditional Q", () => {
  test("any path keeps Respond to R1-R3 only", () => {
    const engine = new AssessmentEngine();
    for (const dimension of ["GF", "CV", "RG", "RM", "MI"] as const) {
      engine.onScreeningAnswered(dimension, 3);
    }
    const respondIds = engine
      .getActiveQuestionIds()
      .filter((id) =>
        (RESPOND_QUESTION_IDS as readonly string[]).includes(id),
      );
    expect(respondIds.sort()).toEqual([...RESPOND_QUESTION_IDS].sort());
    expect(
      ASSESSMENT_QUESTIONS.filter((q) => q.dimension === "Respond").every(
        (q) => q.type === "respond",
      ),
    ).toBe(true);
  });
});

describe("L#15 active question IDs max 25", () => {
  test("worst-case branching stays within cap", () => {
    const engine = new AssessmentEngine();
    for (const dimension of ["GF", "CV", "RG", "RM", "MI"] as const) {
      engine.onScreeningAnswered(dimension, 3);
    }
    expect(engine.getActiveQuestionIds().length).toBeLessThanOrEqual(25);
    expect(engine.getActiveQuestionIds().length).toBe(25);
  });
});

describe("L#17 R2 = 0%", () => {
  test("Low band", () => {
    const R2 = resolveRespondField(30, 0);
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.band).toBe("Low");
    }
  });
});

describe("L#18 R2 = 10%", () => {
  test("Low band inclusive boundary", () => {
    const R2 = resolveRespondField(30, 10);
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.band).toBe("Low");
    }
  });
});

describe("L#19 R2 = 10.01%", () => {
  test("Moderate band", () => {
    const R2 = resolveRespondField(30, 10.01);
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.band).toBe("Moderate");
    }
  });
});

describe("L#20 R2 = 20%", () => {
  test("Moderate band inclusive boundary", () => {
    const R2 = resolveRespondField(30, 20);
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.band).toBe("Moderate");
    }
  });
});

describe("L#21 R2 = 20.01%", () => {
  test("High band", () => {
    const R2 = resolveRespondField(30, 20.01);
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.band).toBe("High");
    }
  });
});

describe("L#22 R2 visitor-provided", () => {
  test("confidence High regardless of band", () => {
    const R2 = resolveRespondField(30, 25);
    expect(R2.source).toBe("visitor_provided");
    const result = respondSeverity(R2);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.confidence).toBe("High");
    }
  });
});

describe("L#23 R2 modeled/default/not-sure", () => {
  test("confidence Low regardless of band", () => {
    const modeled = resolveRespondField(30, undefined);
    const notSure = resolveRespondField(30, "not_sure");
    expect(respondSeverity(modeled).confidence).toBe("Low");
    expect(respondSeverity(notSure).confidence).toBe("Low");
  });
});

describe("L#24 R2 unusable", () => {
  test("needs_clarification, Low confidence, not ranked", () => {
    const R2: ResolvedRespondField = {
      value: Number.NaN,
      source: "modeled",
      defaultValue: 30,
      explicitlyMarkedNotSure: false,
    };
    const result = respondSeverity(R2);
    expect(result.status).toBe("needs_clarification");
    expect(result.confidence).toBe("Low");
    expect("score" in result).toBe(false);
  });
});

describe("L#25 R1/R3 change, R2 same", () => {
  test("Respond band/confidence/score unchanged", () => {
    const defaults = getCalculatorDefaults("HVAC", 10);
    const baseline = respondSeverity(
      resolveRespondInputs(defaults, {}).R2,
    );
    const changed = respondSeverity(
      resolveRespondInputs(defaults, {
        monthlyCalls: 999,
        avgJobValue: 9999,
      }).R2,
    );
    expect(changed).toEqual(baseline);
  });
});

describe("L#26 dollar estimate up, R2 same", () => {
  test("Respond band/score unchanged", () => {
    const defaults = getCalculatorDefaults("HVAC", 10);
    const R2 = resolveRespondInputs(defaults, {}).R2;
    const baseline = respondSeverity(R2);
    const lowEstimate = respondDollarEstimateOrFallback(
      "HVAC",
      10,
      resolveRespondField(defaults.monthlyCalls, defaults.monthlyCalls),
      R2,
      resolveRespondField(defaults.avgJobValue, defaults.avgJobValue),
    );
    const highEstimate = respondDollarEstimateOrFallback(
      "HVAC",
      10,
      resolveRespondField(defaults.monthlyCalls, 9999),
      R2,
      resolveRespondField(defaults.avgJobValue, 9999),
    );
    expect(respondSeverity(R2)).toEqual(baseline);
    expect(lowEstimate.estimate).not.toBeNull();
    expect(highEstimate.estimate).not.toBeNull();
    expect(highEstimate.estimate![1]!.totalAnnualBenefit).toBeGreaterThan(
      lowEstimate.estimate![1]!.totalAnnualBenefit,
    );
  });
});

describe("L#27 all modeled combined label", () => {
  test("exact F.1 string", () => {
    const defaults = getCalculatorDefaults("Plumbers", 5);
    const inputs = resolveRespondInputs(defaults, {});
    expect(inputs.label).toBe(
      "Estimate based on your business type and size.",
    );
  });
});

describe("L#28 all visitor-provided combined label", () => {
  test("exact F.1 string", () => {
    const defaults = getCalculatorDefaults("Plumbers", 5);
    const inputs = resolveRespondInputs(defaults, {
      monthlyCalls: 400,
      missedCallRatePct: 12,
      avgJobValue: 500,
    });
    expect(inputs.label).toBe("Calculated using the numbers you provided.");
  });
});

describe("L#29 mixed sources combined label", () => {
  test("exact F.1 string", () => {
    const defaults = getCalculatorDefaults("Plumbers", 5);
    const inputs = resolveRespondInputs(defaults, {
      missedCallRatePct: 12,
    });
    expect(inputs.label).toBe(
      "Calculated using your information and modeled assumptions.",
    );
  });
});

describe("supplemental S-ENG-01 roundHalfUp", () => {
  test("uses half-up not banker's rounding", () => {
    expect(roundHalfUp(33.5)).toBe(34);
    expect(roundHalfUp(66.5)).toBe(67);
  });
});

describe("supplemental S-ENG-02 confidence with unavailable answers", () => {
  test("two or more unavailable applicable answers yields Low", () => {
    expect(confidence(2, [], 2, false)).toBe("Low");
  });
});

describe("supplemental S-ENG-03 material conflict confidence", () => {
  test("screening vs follow-up divergence yields Medium", () => {
    expect(confidence(3, [0, 0, 0], 0, false)).toBe("Medium");
  });
});

describe("supplemental S-ENG-04 initial ask order", () => {
  test("starts with BP1 through MI-S", () => {
    const engine = new AssessmentEngine();
    expect(engine.getActiveQuestionIds().slice(0, 10)).toEqual([
      "BP1",
      "BP2",
      "R1",
      "R2",
      "R3",
      "GF-S",
      "CV-S",
      "RG-S",
      "RM-S",
      "MI-S",
    ]);
  });
});

describe("supplemental S-ENG-05 screening 0 opens no follow-ups", () => {
  test("GF dimension stays at screening only", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 0);
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F1");
  });
});

describe("supplemental S-ENG-06 screening 3 opens three follow-ups", () => {
  test("adds GF-F1 through GF-F3", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    expect(engine.getActiveQuestionIds()).toEqual(
      expect.arrayContaining(["GF-F1", "GF-F2", "GF-F3"]),
    );
  });
});

describe("supplemental S-ENG-07 not sure opens one follow-up", () => {
  test("adds only first follow-up id", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("CV", "not_sure");
    expect(engine.getActiveQuestionIds()).toContain("CV-F1");
    expect(engine.getActiveQuestionIds()).not.toContain("CV-F2");
  });
});

describe("supplemental S-ENG-08 respond severity score cap", () => {
  test("internal tie-break score never exceeds 100", () => {
    const result = respondSeverity(resolveRespondField(30, 100));
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBe(100);
    }
  });
});

describe("supplemental S-ENG-09 priority order band precedence", () => {
  test("High band ranks before Low band", () => {
    const { rankedGroups } = priorityOrder([
      scoredDimension("GF", 33, "Low", "High"),
      scoredDimension("CV", 67, "High", "High"),
    ]);
    expect(rankedGroups[0]![0]!.key).toBe("CV");
  });
});

describe("supplemental S-ENG-10 clarify group separation", () => {
  test("needs_clarification dimensions excluded from ranked groups", () => {
    const { rankedGroups, clarifyGroup } = priorityOrder([
      scoredDimension("GF", 33, "Low", "High"),
      {
        key: "Respond",
        label: "Respond",
        status: "needs_clarification",
        confidence: "Low",
      },
    ]);
    expect(rankedGroups).toHaveLength(1);
    expect(clarifyGroup).toHaveLength(1);
    expect(clarifyGroup[0]!.key).toBe("Respond");
  });
});

describe("supplemental S-ENG-11 screening-only formula", () => {
  test("score equals roundHalfUp(screen/3*100)", () => {
    expect(dimensionSeverity(1, [])).toMatchObject({
      status: "scored",
      score: 33,
      band: "Low",
    });
  });
});

describe("supplemental S-ENG-12 onScreeningChanged clears answers", () => {
  test("follow-up answers removed from engine state", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("RM", 2);
    engine.setAnswer("RM-F1", 2);
    engine.onScreeningChanged("RM", 1);
    expect(engine.getFollowUpAnswers("RM")).toEqual([]);
  });
});

describe("supplemental S-ENG-13 exact tie grouping", () => {
  test("three-way tie stays in one group", () => {
    const tied = scoredDimension("MI", 100, "High", "High");
    const { rankedGroups } = priorityOrder([
      tied,
      { ...tied, key: "GF" },
      { ...tied, key: "CV" },
    ]);
    expect(rankedGroups[0]).toHaveLength(3);
  });
});

describe("supplemental S-ENG-14 respond question types", () => {
  test("Respond questions are respond type only", () => {
    const respondQuestions = ASSESSMENT_QUESTIONS.filter(
      (q) => q.dimension === "Respond",
    );
    expect(respondQuestions.map((q) => q.id).sort()).toEqual([
      "R1",
      "R2",
      "R3",
    ]);
    expect(respondQuestions.every((q) => q.type === "respond")).toBe(true);
  });
});

describe("supplemental S-ENG-15 runAssessment end-to-end", () => {
  test("orchestrates engine from answers", () => {
    const result = runAssessment({
      BP1: "HVAC",
      BP2: 10,
      "GF-S": 2,
      "GF-F1": 1,
      "GF-F2": 2,
      "GF-F3": 0,
      "CV-S": 1,
      "CV-F1": "not_sure",
      "RG-S": 0,
      "RM-S": 3,
      "RM-F1": 2,
      "RM-F2": 2,
      "RM-F3": 2,
      "MI-S": 2,
      "MI-F1": 0,
      "MI-F2": 1,
      "MI-F3": 2,
    });
    expect(result.combinedLabel).toBe(
      "Estimate based on your business type and size.",
    );
    expect(result.priorityGroups.length).toBeGreaterThan(0);
    expect(result.respondSeverity.status).toBe("scored");
    expect(result.activeQuestionIds.length).toBeLessThanOrEqual(25);
  });
});
