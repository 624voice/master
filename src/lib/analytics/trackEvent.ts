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

/**
 * Four events authorized to carry limited contact/answer-adjacent payload fields.
 * Current dispatch sends only operational metadata (source, hasEstimate).
 * See analyticsContract.ts for permitted properties per event.
 */
export const LIMITED_PAYLOAD_ANALYTICS_EVENTS = new Set<AnalyticsEventName>([
  ANALYTICS_EVENTS.lead_gate_complete,
  ANALYTICS_EVENTS.sms_consent_opt_in,
  ANALYTICS_EVENTS.assessment_complete,
  ANALYTICS_EVENTS.roi_agent_triggered,
]);

/** @deprecated Use LIMITED_PAYLOAD_ANALYTICS_EVENTS */
export const PII_ANALYTICS_EVENTS = LIMITED_PAYLOAD_ANALYTICS_EVENTS;

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
  sink(name, props);
}

export function isLimitedPayloadAnalyticsEvent(name: AnalyticsEventName): boolean {
  return LIMITED_PAYLOAD_ANALYTICS_EVENTS.has(name);
}

/** @deprecated Use isLimitedPayloadAnalyticsEvent */
export function isPiiAnalyticsEvent(name: AnalyticsEventName): boolean {
  return isLimitedPayloadAnalyticsEvent(name);
}
