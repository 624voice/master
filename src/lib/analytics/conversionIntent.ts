/**
 * Conversion intent analytics (separate from the locked ten-event assessment contract).
 * External destinations (GA, etc.) are not configured; events reach the in-app sink only.
 */

export const CONVERSION_ANALYTICS_EVENTS = {
  homepage_demo_click: "homepage_demo_click",
  homepage_roi_click: "homepage_roi_click",
  homepage_assessment_click: "homepage_assessment_click",
  homepage_book_click: "homepage_book_click",
  demo_form_started: "demo_form_started",
  demo_form_completed: "demo_form_completed",
  demo_started: "demo_started",
  roi_calculation_completed: "roi_calculation_completed",
  roi_report_unlock_started: "roi_report_unlock_started",
  roi_report_unlock_completed: "roi_report_unlock_completed",
  contact_form_submitted: "contact_form_submitted",
  booking_page_reached: "booking_page_reached",
} as const;

export type ConversionAnalyticsEventName =
  (typeof CONVERSION_ANALYTICS_EVENTS)[keyof typeof CONVERSION_ANALYTICS_EVENTS];

export type ConversionAnalyticsProps = Record<string, string>;

type ConversionSink = (
  name: ConversionAnalyticsEventName,
  props: ConversionAnalyticsProps,
) => void;

let sink: ConversionSink = (name, props) => {
  if (import.meta.env.DEV) {
    console.info("[conversion-analytics]", { event: name, ...props });
  }
};

export function setConversionAnalyticsSink(next: ConversionSink): void {
  sink = next;
}

export function trackConversionEvent(
  name: ConversionAnalyticsEventName,
  props: ConversionAnalyticsProps = {},
): void {
  sink(name, props);
}

/** Maps data-analytics-intent attribute values to conversion event names. */
export const INTENT_TO_CONVERSION_EVENT: Record<string, ConversionAnalyticsEventName> = {
  home_primary_demo: CONVERSION_ANALYTICS_EVENTS.homepage_demo_click,
  home_demo_cta: CONVERSION_ANALYTICS_EVENTS.homepage_demo_click,
  home_secondary_roi: CONVERSION_ANALYTICS_EVENTS.homepage_roi_click,
  home_secondary_assessment: CONVERSION_ANALYTICS_EVENTS.homepage_assessment_click,
  home_roi_tool: CONVERSION_ANALYTICS_EVENTS.homepage_roi_click,
  home_final_roi: CONVERSION_ANALYTICS_EVENTS.homepage_roi_click,
  home_assessment_tool: CONVERSION_ANALYTICS_EVENTS.homepage_assessment_click,
  home_final_book: CONVERSION_ANALYTICS_EVENTS.homepage_book_click,
};

export function conversionEventForIntent(
  intent: string | null | undefined,
): ConversionAnalyticsEventName | null {
  if (!intent) return null;
  return INTENT_TO_CONVERSION_EVENT[intent] ?? null;
}

export function installConversionIntentCollector(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest("[data-analytics-intent]");
    if (!el) return;
    const intent = el.getAttribute("data-analytics-intent");
    const mapped = conversionEventForIntent(intent);
    if (!mapped) return;
    trackConversionEvent(mapped, {
      intent: intent ?? "",
      href: el.getAttribute("href") ?? "",
      source: "data-analytics-intent",
    });
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
