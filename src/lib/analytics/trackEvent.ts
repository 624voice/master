/** Ten Assessment analytics events (Phase2Final Section 14). */
export const ANALYTICS_EVENTS = {
  assessment_started: "assessment_started",
  assessment_question_answered: "assessment_question_answered",
  assessment_branch_opened: "assessment_branch_opened",
  assessment_teaser_viewed: "assessment_teaser_viewed",
  lead_gate_complete: "lead_gate_complete",
  sms_consent_opt_in: "sms_consent_opt_in",
  assessment_complete: "assessment_complete",
  assessment_report_downloaded: "assessment_report_downloaded",
  roi_agent_triggered: "roi_agent_triggered",
  roi_document_generated: "roi_document_generated",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Events that may carry PII or answer payload (S-AN-02). */
export const PII_ANALYTICS_EVENTS = new Set<AnalyticsEventName>([
  ANALYTICS_EVENTS.lead_gate_complete,
  ANALYTICS_EVENTS.sms_consent_opt_in,
  ANALYTICS_EVENTS.assessment_complete,
  ANALYTICS_EVENTS.roi_agent_triggered,
]);

export type AnalyticsEventProps = Record<string, string | number | boolean>;

type AnalyticsSink = (
  name: AnalyticsEventName,
  props: AnalyticsEventProps,
) => void;

let sink: AnalyticsSink = (name, props) => {
  if (import.meta.env.DEV) {
    console.info("[analytics]", { event: name, ...props });
  }
};

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export function trackEvent(
  name: AnalyticsEventName,
  props: AnalyticsEventProps = {},
): void {
  if (PII_ANALYTICS_EVENTS.has(name)) {
    sink(name, props);
    return;
  }
  sink(name, props);
}

export function isPiiAnalyticsEvent(name: AnalyticsEventName): boolean {
  return PII_ANALYTICS_EVENTS.has(name);
}
