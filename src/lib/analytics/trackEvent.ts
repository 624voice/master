import { FEATURE_FLAGS } from "~/config/features";

/** S-AN-01: assessment lead successfully submitted. */
export const ANALYTICS_EVENT_ASSESSMENT_SUBMITTED = "assessment_submitted" as const;

/** S-AN-02: assessment submission blocked by rate limit. */
export const ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED =
  "assessment_rate_limited" as const;

export type AnalyticsEventName =
  | typeof ANALYTICS_EVENT_ASSESSMENT_SUBMITTED
  | typeof ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED;

export type AnalyticsEventPayload = {
  source?: string;
  trade?: string;
  idempotencyCase?: string;
  replaySubstate?: string;
  limitType?: "source" | "phone";
  count?: number;
};

export function trackEvent(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload = {},
): void {
  if (!FEATURE_FLAGS.ASSESSMENT_ANALYTICS_ENABLED) {
    return;
  }

  console.info("[analytics]", {
    event: name,
    ...payload,
    capturedAt: new Date().toISOString(),
  });
}
