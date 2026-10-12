import { describe, expect, test } from "bun:test";
import {
  ANALYTICS_EVENTS,
  isPiiAnalyticsEvent,
  PII_ANALYTICS_EVENTS,
  setAnalyticsSink,
  trackEvent,
  type AnalyticsEventName,
} from "~/lib/analytics/trackEvent";

describe("trackEvent", () => {
  test("S-AN-01: typed dispatch through no-op adapter", () => {
    const calls: Array<{ name: AnalyticsEventName; props: Record<string, unknown> }> =
      [];
    setAnalyticsSink((name, props) => {
      calls.push({ name, props });
    });

    trackEvent(ANALYTICS_EVENTS.assessment_started);
    trackEvent(ANALYTICS_EVENTS.assessment_question_answered, {
      questionId: "GF-S",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.name).toBe("assessment_started");
    expect(calls[1]?.name).toBe("assessment_question_answered");
  });

  test("S-AN-02: limited-payload authorization confined to exactly four events", () => {
    const allEvents = Object.values(ANALYTICS_EVENTS);
    expect(PII_ANALYTICS_EVENTS.size).toBe(4);
    const limitedPayloadEvents = new Set<string>([
      ANALYTICS_EVENTS.lead_gate_complete,
      ANALYTICS_EVENTS.sms_consent_opt_in,
      ANALYTICS_EVENTS.assessment_complete,
      ANALYTICS_EVENTS.roi_agent_triggered,
    ]);
    for (const event of allEvents) {
      expect(isPiiAnalyticsEvent(event)).toBe(limitedPayloadEvents.has(event));
    }
  });
});
