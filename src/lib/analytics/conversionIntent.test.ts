import { describe, expect, test } from "bun:test";
import {
  CONVERSION_ANALYTICS_EVENTS,
  conversionEventForIntent,
  installConversionIntentCollector,
  setConversionAnalyticsSink,
  trackConversionEvent,
} from "~/lib/analytics/conversionIntent";

describe("conversion intent analytics", () => {
  test("maps homepage demo intent to homepage_demo_click", () => {
    expect(conversionEventForIntent("home_primary_demo")).toBe(
      CONVERSION_ANALYTICS_EVENTS.homepage_demo_click,
    );
  });

  test("intent map covers homepage book and ROI intents", () => {
    expect(conversionEventForIntent("home_final_book")).toBe(
      CONVERSION_ANALYTICS_EVENTS.homepage_book_click,
    );
    expect(conversionEventForIntent("home_assessment_tool")).toBe(
      CONVERSION_ANALYTICS_EVENTS.homepage_assessment_click,
    );
    expect(installConversionIntentCollector()).toBeTypeOf("function");
  });

  test("trackConversionEvent reaches sink for booking page", () => {
    const names: string[] = [];
    setConversionAnalyticsSink((name) => {
      names.push(name);
    });
    trackConversionEvent(CONVERSION_ANALYTICS_EVENTS.booking_page_reached, {
      source: "book_route_mount",
    });
    expect(names).toEqual([CONVERSION_ANALYTICS_EVENTS.booking_page_reached]);
  });
});
