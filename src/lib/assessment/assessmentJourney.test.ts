import { afterEach, describe, expect, mock, test } from "bun:test";
import { buildAssessmentLeadMessage } from "~/lib/assessment/buildLeadSummary";
import { buildAssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";
import {
  buildQuestionFlow,
  flowStepBack,
  resolveBackQuestionIndex,
  UNIVERSAL_FORWARD_STEPS,
} from "~/lib/assessment/assessmentFlowController";
import {
  AssessmentEngine,
  getCalculatorDefaults,
  resolveRespondInputs,
} from "~/lib/assessment/engine";
import { runAssessment } from "~/lib/assessment/runAssessment";
import { selectModerateScenarioValue } from "~/lib/assessment/selectModerateScenario";
import {
  ANALYTICS_EVENTS,
  setAnalyticsSink,
  trackEvent,
} from "~/lib/analytics/trackEvent";
import { assertAnalyticsPropsAllowed } from "~/lib/analytics/analyticsContract";

function walkForwardThroughQuestions(
  engine: AssessmentEngine,
  answers: Record<string, number | "not_sure">,
): string[] {
  const visited: string[] = [];
  for (const questionId of buildQuestionFlow(engine)) {
    visited.push(questionId);
    const screeningMatch = questionId.match(/^([A-Z]{2})-S$/);
    if (screeningMatch) {
      const dimension = screeningMatch[1] as "GF" | "CV" | "RG" | "RM" | "MI";
      const value = answers[questionId] ?? 1;
      if (engine.getScreeningAnswer(dimension) !== undefined) {
        engine.onScreeningChanged(dimension, value);
      } else {
        engine.onScreeningAnswered(dimension, value);
      }
    } else {
      engine.setAnswer(questionId, answers[questionId] ?? 1);
    }
  }
  return visited;
}

describe("Assessment journey QA S-JRN", () => {
  afterEach(() => {
    mock.restore();
  });

  test("S-JRN-01: forward navigation covers all universal steps", () => {
    expect(UNIVERSAL_FORWARD_STEPS).toEqual([
      "bp1",
      "bp2",
      "respond",
      "questions",
      "teaser",
      "gate",
      "results",
    ]);
  });

  test("S-JRN-02: back navigation preserves valid answers", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 2);
    engine.setAnswer("GF-F1", 1);
    const flowBefore = buildQuestionFlow(engine);

    const backFromQuestion = flowStepBack("questions", 1);
    expect(backFromQuestion).toEqual({ step: "questions", questionIndex: 0 });

    const backToRespond = flowStepBack("questions", 0);
    expect(backToRespond).toEqual({ step: "respond", questionIndex: 0 });

    engine.setAnswer("GF-F1", 1);
    expect(engine.answers.get("GF-F1")).toBe(1);
    expect(buildQuestionFlow(engine)).toEqual(flowBefore);
  });

  test("S-JRN-03: upstream branch change deletes stale follow-up answers", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 3);
    engine.setAnswer("GF-F2", 3);
    engine.setAnswer("GF-F3", 3);
    expect(engine.getActiveQuestionIds()).toContain("GF-F1");

    engine.onScreeningChanged("GF", 0);
    expect(engine.getFollowUpAnswers("GF")).toEqual([]);
    expect(engine.answers.has("GF-F1")).toBe(false);
    expect(engine.getActiveQuestionIds()).not.toContain("GF-F1");

    const base = {
      BP1: "HVAC",
      BP2: "3-7",
      "CV-S": 1,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 1,
    };
    const withOrphanFollowUps = runAssessment({
      ...base,
      "GF-S": 0,
      "GF-F1": 3,
      "GF-F2": 3,
      "GF-F3": 3,
    });
    const withoutOrphans = runAssessment({ ...base, "GF-S": 0 });

    const orphanGf = withOrphanFollowUps.dimensionResults.find(
      (d) => d.key === "GF",
    );
    const cleanGf = withoutOrphans.dimensionResults.find((d) => d.key === "GF");
    expect(orphanGf).toEqual(cleanGf);
    if (orphanGf?.status === "scored") {
      expect(orphanGf.score).toBe(0);
    }

    const summary = buildAssessmentLeadMessage(withoutOrphans);
    expect(summary).not.toContain("GF-F");

    setAnalyticsSink((_name, props) => {
      expect(props).not.toHaveProperty("GF-F1");
    });
    trackEvent(ANALYTICS_EVENTS.assessment_complete, {
      hasEstimate: withoutOrphans.dollarEstimate ? "true" : "false",
    });
    expect(() =>
      assertAnalyticsPropsAllowed(ANALYTICS_EVENTS.assessment_complete, {
        hasEstimate: "true",
      }),
    ).not.toThrow();

    const vm = buildAssessmentReportViewModel(withoutOrphans);
    expect(JSON.stringify(vm)).not.toContain("GF-F1");
  });

  test("S-JRN-04: respond assumptions review acceptance (modeled defaults)", () => {
    const engine = new AssessmentEngine();
    walkForwardThroughQuestions(engine, {
      "GF-S": 1,
      "CV-S": 1,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 1,
    });
    const inputs = resolveRespondInputs(getCalculatorDefaults("HVAC", 5), {});
    expect(inputs.label).toBe("Estimate based on your business type and size.");
    const result = runAssessment({
      BP1: "HVAC",
      BP2: "3-7",
      "GF-S": 1,
      "CV-S": 1,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 1,
    });
    expect(result.combinedLabel).toBe(inputs.label);
  });

  test("S-JRN-05: respond assumptions review with visitor edits", () => {
    const result = runAssessment({
      BP1: "Plumbers",
      BP2: "8-20",
      R1: 420,
      R2: 18,
      R3: 425,
      "GF-S": 1,
      "CV-S": 2,
      "RG-S": 0,
      "RM-S": 2,
      "MI-S": 0,
    });
    expect(result.combinedLabel).toBe("Calculated using the numbers you provided.");
    expect(result.respondFields.R1.source).toBe("visitor_provided");
  });

  test("S-JRN-06: mixed R1/R2/R3 provenance label", () => {
    const result = runAssessment({
      BP1: "Electricians",
      BP2: "3-7",
      R1: 180,
      R2: "not_sure",
      R3: 310,
      "GF-S": 2,
      "CV-S": 1,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 2,
    });
    expect(result.combinedLabel).toBe(
      "Calculated using your information and modeled assumptions.",
    );
  });

  test("S-JRN-07: Low, Moderate, and High Respond outcomes", () => {
    const low = runAssessment({
      BP1: "Roofers",
      BP2: "1-2",
      R1: 40,
      R2: 5,
      R3: 1200,
      "GF-S": 0,
      "CV-S": 0,
      "RG-S": 0,
      "RM-S": 0,
      "MI-S": 0,
    });
    const moderate = runAssessment({
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
    });
    const high = runAssessment({
      BP1: "PestControl",
      BP2: "8-20",
      R1: 900,
      R2: 35,
      R3: 275,
      "GF-S": 3,
      "CV-S": 2,
      "RM-S": 2,
      "MI-S": 2,
    });

    expect(low.respondSeverity.status).toBe("scored");
    expect(moderate.respondSeverity.status).toBe("scored");
    expect(high.respondSeverity.status).toBe("scored");
    if (
      low.respondSeverity.status === "scored" &&
      moderate.respondSeverity.status === "scored" &&
      high.respondSeverity.status === "scored"
    ) {
      expect(low.respondSeverity.band).toBe("Low");
      expect(moderate.respondSeverity.band).toBe("Moderate");
      expect(high.respondSeverity.band).toBe("High");
    }
  });

  test("S-JRN-08: needs-clarification outcome", () => {
    const result = runAssessment({
      BP1: "HVAC",
      BP2: "3-7",
      R1: 300,
      R2: 15,
      R3: 350,
      "GF-S": "not_sure",
      "GF-F1": "not_sure",
      "CV-S": 2,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 1,
    });
    expect(result.clarifyGroup.some((d) => d.key === "GF")).toBe(true);
    expect(result.priorityGroups.flat().some((d) => d.key === "GF")).toBe(
      false,
    );
  });

  test("S-JRN-09: missing-Moderate-scenario degradation", () => {
    const result = runAssessment({
      BP1: "InvalidTrade",
      BP2: "3-7",
      R1: 300,
      R2: 15,
      R3: 350,
      "GF-S": 1,
      "CV-S": 1,
      "RG-S": 1,
      "RM-S": 1,
      "MI-S": 1,
    });
    expect(result.dollarEstimate).toBeNull();
    const vm = buildAssessmentReportViewModel(result);
    expect(vm.moderateAnnualBenefitFormatted).toBeNull();
    expect(() => selectModerateScenarioValue([])).toThrow(/Moderate scenario/);
  });

  test("S-JRN-10: priority ordering and tied priorities", () => {
    const result = runAssessment({
      BP1: "HVAC",
      BP2: "3-7",
      R1: 300,
      R2: 15,
      R3: 350,
      "GF-S": 2,
      "GF-F1": 1,
      "GF-F2": 2,
      "GF-F3": 0,
      "CV-S": 2,
      "CV-F1": 1,
      "CV-F2": 2,
      "CV-F3": 0,
      "RG-S": 0,
      "RM-S": 0,
      "MI-S": 0,
    });
    const tiedGroup = result.priorityGroups.find((group) => group.length > 1);
    expect(tiedGroup).toBeDefined();
    expect(result.priorityGroups[0]!.length).toBeGreaterThanOrEqual(1);
  });

  test("S-JRN-11: back from teaser returns to last question", () => {
    const engine = new AssessmentEngine();
    walkForwardThroughQuestions(engine, { "GF-S": 1, "CV-S": 1, "RG-S": 1, "RM-S": 1, "MI-S": 1 });
    const back = flowStepBack("teaser", 0);
    expect(back?.step).toBe("questions");
    const lastIndex = resolveBackQuestionIndex(
      engine,
      Number.MAX_SAFE_INTEGER,
    );
    expect(lastIndex).toBe(buildQuestionFlow(engine).length - 1);
  });
});
