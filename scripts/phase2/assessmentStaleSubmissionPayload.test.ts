/**
 * Proves stale GF-F1/F2/F3 absent from final serialized submission pipeline.
 */
import { describe, expect, test } from "bun:test";
import { AssessmentEngine } from "../../src/lib/assessment/engine";
import { runAssessment } from "../../src/lib/assessment/runAssessment";
import { buildAssessmentLeadMessage } from "../../src/lib/assessment/buildLeadSummary";
import { buildAssessmentReportViewModel } from "../../src/lib/assessment/buildAssessmentReportViewModel";
import { buildAnswersPayloadMirror } from "./buildAnswersPayloadMirror";
import { assertAnalyticsPropsAllowed } from "../../src/lib/analytics/analyticsContract";
import { ANALYTICS_EVENTS, setAnalyticsSink, trackEvent } from "../../src/lib/analytics/trackEvent";

describe("assessment stale submission serialization", () => {
  test("X-SAFE-PREVIEW-FOCUS-06: serialized submission excludes GF-F1/F2/F3 after GF-S lowered", () => {
    const engine = new AssessmentEngine();
    engine.onScreeningAnswered("GF", 3);
    engine.setAnswer("GF-F1", 2);
    engine.setAnswer("GF-F2", 1);
    engine.setAnswer("GF-F3", 0);
    engine.setAnswer("CV-S", 0);
    engine.setAnswer("RG-S", 0);
    engine.setAnswer("RM-S", 0);
    engine.setAnswer("MI-S", 0);

    engine.onScreeningChanged("GF", 0);

    const payload = buildAnswersPayloadMirror("HVAC", "3-7", { monthlyCalls: 450 }, engine);
    const payloadJson = JSON.stringify(payload);

    expect(payload).not.toHaveProperty("GF-F1");
    expect(payload).not.toHaveProperty("GF-F2");
    expect(payload).not.toHaveProperty("GF-F3");
    expect(payloadJson).not.toContain("GF-F1");
    expect(payloadJson).not.toContain("GF-F2");
    expect(payloadJson).not.toContain("GF-F3");
    expect(Object.keys(payload).filter((k) => k.startsWith("GF-F"))).toEqual([]);

    const assessment = runAssessment(payload);
    const leadSummary = buildAssessmentLeadMessage(assessment);
    expect(leadSummary).not.toContain("GF-F1");
    expect(leadSummary).not.toContain("GF-F2");
    expect(leadSummary).not.toContain("GF-F3");

    const vm = buildAssessmentReportViewModel(assessment);
    const vmJson = JSON.stringify(vm);
    expect(vmJson).not.toContain("GF-F1");
    expect(vmJson).not.toContain("GF-F2");
    expect(vmJson).not.toContain("GF-F3");

    const redisLikeSnapshot = JSON.stringify({
      answers: payload,
      assessment,
      lead: { firstName: "Alex", lastName: "Testowner" },
    });
    expect(redisLikeSnapshot).not.toContain("GF-F1");
    expect(redisLikeSnapshot).not.toContain("GF-F2");
    expect(redisLikeSnapshot).not.toContain("GF-F3");

    setAnalyticsSink((_name, props) => {
      const serialized = JSON.stringify(props);
      expect(serialized).not.toContain("GF-F1");
      expect(serialized).not.toContain("GF-F2");
      expect(serialized).not.toContain("GF-F3");
    });
    trackEvent(ANALYTICS_EVENTS.assessment_complete, {
      hasEstimate: assessment.dollarEstimate ? "true" : "false",
    });
    expect(() =>
      assertAnalyticsPropsAllowed(ANALYTICS_EVENTS.assessment_complete, {
        hasEstimate: "true",
      }),
    ).not.toThrow();
  });
});
