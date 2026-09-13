import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED,
  ANALYTICS_EVENT_ASSESSMENT_SUBMITTED,
  trackEvent,
} from "~/lib/analytics/trackEvent";

describe("trackEvent", () => {
  afterEach(() => {
    mock.restore();
  });

  test("S-AN-01 emits assessment_submitted when analytics enabled", () => {
    const info = mock(() => undefined);
    console.info = info;

    trackEvent(ANALYTICS_EVENT_ASSESSMENT_SUBMITTED, {
      source: "assessment_form",
      trade: "Plumbers",
    });

    expect(info).toHaveBeenCalled();
    const payload = info.mock.calls[0]?.[1] as { event: string; trade: string };
    expect(payload.event).toBe("assessment_submitted");
    expect(payload.trade).toBe("Plumbers");
  });

  test("S-AN-02 emits assessment_rate_limited when analytics enabled", () => {
    const info = mock(() => undefined);
    console.info = info;

    trackEvent(ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED, {
      source: "assessment_form",
      limitType: "source",
      count: 30,
    });

    expect(info).toHaveBeenCalled();
    const payload = info.mock.calls[0]?.[1] as {
      event: string;
      limitType: string;
      count: number;
    };
    expect(payload.event).toBe("assessment_rate_limited");
    expect(payload.limitType).toBe("source");
    expect(payload.count).toBe(30);
  });
});
