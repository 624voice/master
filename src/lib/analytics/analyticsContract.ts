import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from "~/lib/analytics/trackEvent";

/** Property classification for analytics privacy contract (Phase 2 Section 14). */
export type AnalyticsPropertyKind =
  | "operational_metadata"
  | "assessment_answer_metadata"
  | "non_identifying_analytics";

/**
 * Four events authorized to carry limited contact or answer-adjacent payload fields.
 * Current implementation sends only operational metadata (source, hasEstimate).
 * Name, email, phone, raw answer values, tokens, and report data remain prohibited.
 */
export const LIMITED_PAYLOAD_ANALYTICS_EVENTS = new Set<AnalyticsEventName>([
  ANALYTICS_EVENTS.lead_gate_complete,
  ANALYTICS_EVENTS.sms_consent_opt_in,
  ANALYTICS_EVENTS.assessment_complete,
  ANALYTICS_EVENTS.roi_agent_triggered,
]);

/** Six events prohibited from carrying contact information, raw answers, or report tokens. */
export const CONTACT_ANSWER_PROHIBITED_EVENTS = new Set<AnalyticsEventName>(
  Object.values(ANALYTICS_EVENTS).filter(
    (event) => !LIMITED_PAYLOAD_ANALYTICS_EVENTS.has(event),
  ),
);

export type AnalyticsEventContractRow = {
  event: AnalyticsEventName;
  dispatch: "client" | "server";
  dispatchFile: string;
  permittedProperties: Record<string, AnalyticsPropertyKind>;
  prohibitedProperties: string[];
  enforcement: "allowlist_props_in_tests";
};

/** Locked ten-event analytics contract (Phase2Final Section 14). */
export const ANALYTICS_EVENT_CONTRACT: AnalyticsEventContractRow[] = [
  {
    event: ANALYTICS_EVENTS.assessment_started,
    dispatch: "client",
    dispatchFile: "src/routes/assessment.tsx",
    permittedProperties: {},
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "lastName",
      "answer",
      "token",
      "reportUrl",
      "reportToken",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.assessment_question_answered,
    dispatch: "client",
    dispatchFile: "src/routes/assessment.tsx",
    permittedProperties: {
      questionId: "assessment_answer_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "answer",
      "answerValue",
      "token",
      "reportUrl",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.assessment_branch_opened,
    dispatch: "client",
    dispatchFile: "src/routes/assessment.tsx",
    permittedProperties: {
      dimension: "operational_metadata",
      followUpCount: "non_identifying_analytics",
    },
    prohibitedProperties: ["email", "phone", "firstName", "answer", "token"],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.assessment_teaser_viewed,
    dispatch: "client",
    dispatchFile: "src/routes/assessment.tsx",
    permittedProperties: {
      hasEstimate: "non_identifying_analytics",
    },
    prohibitedProperties: ["email", "phone", "firstName", "answer", "token"],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.lead_gate_complete,
    dispatch: "server",
    dispatchFile: "src/server/submitAssessmentLead.server.ts",
    permittedProperties: {
      source: "operational_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "lastName",
      "answer",
      "token",
      "reportUrl",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.sms_consent_opt_in,
    dispatch: "server",
    dispatchFile: "src/server/submitAssessmentLead.server.ts",
    permittedProperties: {
      source: "operational_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "lastName",
      "answer",
      "token",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.assessment_complete,
    dispatch: "server",
    dispatchFile: "src/server/submitAssessmentLead.server.ts",
    permittedProperties: {
      hasEstimate: "non_identifying_analytics",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "answer",
      "token",
      "reportUrl",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.assessment_report_downloaded,
    dispatch: "client",
    dispatchFile: "src/routes/assessment.tsx",
    permittedProperties: {
      source: "operational_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "answer",
      "token",
      "reportUrl",
      "reportToken",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.roi_agent_triggered,
    dispatch: "server",
    dispatchFile: "src/server/submitAssessmentLead.server.ts",
    permittedProperties: {
      source: "operational_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "lastName",
      "answer",
      "token",
      "reportUrl",
    ],
    enforcement: "allowlist_props_in_tests",
  },
  {
    event: ANALYTICS_EVENTS.roi_document_generated,
    dispatch: "server",
    dispatchFile: "src/server/submitAssessmentLead.server.ts",
    permittedProperties: {
      source: "operational_metadata",
    },
    prohibitedProperties: [
      "email",
      "phone",
      "firstName",
      "answer",
      "token",
      "reportUrl",
      "reportToken",
    ],
    enforcement: "allowlist_props_in_tests",
  },
];

const FORBIDDEN_PROP_PATTERN =
  /(?:email|phone|firstName|lastName|reportToken|reportUrl|token|answerValue|\banswer\b)/i;

export function assertAnalyticsPropsAllowed(
  event: AnalyticsEventName,
  props: AnalyticsEventProps,
): void {
  const row = ANALYTICS_EVENT_CONTRACT.find((entry) => entry.event === event);
  if (!row) {
    throw new Error(`Unknown analytics event: ${event}`);
  }

  for (const key of Object.keys(props)) {
    if (!(key in row.permittedProperties)) {
      throw new Error(
        `Analytics event ${event} received unapproved property "${key}"`,
      );
    }
    if (FORBIDDEN_PROP_PATTERN.test(key)) {
      throw new Error(
        `Analytics event ${event} property key "${key}" matches forbidden pattern`,
      );
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && FORBIDDEN_PROP_PATTERN.test(value)) {
      throw new Error(
        `Analytics event ${event} property "${key}" value resembles forbidden data`,
      );
    }
  }
}
