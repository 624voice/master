import { ASSESSMENT_ROI_AGENT_LIVE_ENABLED } from "~/config/features";
import { ANALYTICS_EVENTS, trackEvent } from "~/lib/analytics/trackEvent";
import { buildAssessmentLeadMessage } from "~/lib/assessment/buildLeadSummary";
import { runAssessment } from "~/lib/assessment/runAssessment";
import { selectModerateScenarioValue } from "~/lib/assessment/selectModerateScenario";
import { validateAssessmentAnswers } from "~/lib/assessment/validateAssessmentAnswers";
import {
  normalizeLeadInfo,
  validateLeadInfo,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { isAssessmentSecurityConfigured } from "~/server/assessment/assessmentSecurity.server";
import { getTrustedClientIp } from "~/server/assessment/getTrustedClientIp";
import {
  buildAssessmentPayloadHash,
  checkAssessmentPhoneIdempotency,
  checkAssessmentSourceRateLimit,
} from "~/server/assessment/rateLimitSource";
import {
  buildAssessmentReportUrl,
  createAssessmentReportToken,
} from "~/server/assessment/reportTokens";
import type { AssessmentReportSnapshot } from "~/server/assessment/types";
import { saveLead } from "~/server/leads";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import type {
  AssessmentLeadRequest,
  AssessmentLeadSuccess,
  StartAssessmentRoiAgentInput,
} from "~/server/submitAssessmentLead";

export async function startAssessmentRoiAgent(
  input: StartAssessmentRoiAgentInput,
): Promise<void> {
  await startAgentConversation(input);
}

function buildSnapshot(
  lead: LeadInfo,
  assessment: ReturnType<typeof runAssessment>,
): AssessmentReportSnapshot {
  return {
    ...assessment,
    lead,
    reportGeneratedAt: new Date().toISOString(),
  };
}

export async function submitAssessmentLeadHandler(
  data: AssessmentLeadRequest,
): Promise<AssessmentLeadSuccess> {
  const leadError = validateLeadInfo(data.lead);
  if (leadError) {
    throw new Error(leadError);
  }

  const validated = validateAssessmentAnswers(data.answers);
  if ("error" in validated) {
    throw new Error(validated.error);
  }

  const normalizedLead = normalizeLeadInfo(data.lead);
  const assessment = runAssessment(validated.answers);

  trackEvent(ANALYTICS_EVENTS.assessment_complete, {
    hasEstimate: assessment.dollarEstimate ? "true" : "false",
  });

  if (!isAssessmentSecurityConfigured()) {
    return {
      ok: true,
      results: assessment,
      persistenceAvailable: false,
      message:
        "Your results are ready. Report download and lead save are temporarily unavailable.",
    };
  }

  const clientIp = getTrustedClientIp();
  const sourceLimit = await checkAssessmentSourceRateLimit({ clientIp });
  if (!sourceLimit.allowed) {
    throw new Error("Too many assessment requests. Please try again later.");
  }

  const snapshot = buildSnapshot(normalizedLead, assessment);
  const payloadHash = buildAssessmentPayloadHash(
    JSON.stringify({ answers: validated.answers, lead: normalizedLead }),
  );

  const responsePlaceholder = JSON.stringify({ ok: true, snapshot: true });
  const phoneLimit = await checkAssessmentPhoneIdempotency({
    phone: normalizedLead.phone,
    idempotencyKey: data.idempotencyKey,
    payloadHash,
    cachedResponse: responsePlaceholder,
  });

  if (!phoneLimit.allowed) {
    if (phoneLimit.case === "c") {
      throw new Error(
        "This submission conflicts with a previous request. Please start a new assessment.",
      );
    }
    throw new Error("This phone number has reached the daily assessment limit.");
  }

  const replayed = phoneLimit.substate === "replay_exact";

  if (!replayed) {
    const moderateValue =
      assessment.dollarEstimate &&
      selectModerateScenarioValue(assessment.dollarEstimate);
    await saveLead({
      ...normalizedLead,
      message: buildAssessmentLeadMessage(assessment),
      moderateRoi: moderateValue ? formatCurrency(moderateValue) : undefined,
      smsConsent: data.smsConsent,
      source: "assessment",
    });
    trackEvent(ANALYTICS_EVENTS.lead_gate_complete, { source: "assessment" });
    if (data.smsConsent) {
      trackEvent(ANALYTICS_EVENTS.sms_consent_opt_in, { source: "assessment" });
    }
  }

  const reportToken = await createAssessmentReportToken({ snapshot });
  const reportUrl = buildAssessmentReportUrl(reportToken);
  trackEvent(ANALYTICS_EVENTS.roi_document_generated, { source: "assessment" });

  const moderateValue =
    assessment.dollarEstimate &&
    selectModerateScenarioValue(assessment.dollarEstimate);
  const formattedAnnualOpportunity = moderateValue
    ? formatCurrency(moderateValue)
    : null;

  if (
    data.smsConsent &&
    ASSESSMENT_ROI_AGENT_LIVE_ENABLED &&
    isSpeed2LeadEnabled() &&
    formattedAnnualOpportunity &&
    reportUrl &&
    !replayed
  ) {
    try {
      const primaryOpportunity =
        assessment.priorityGroups[0]?.[0]?.label ?? "see full report";
      await startAssessmentRoiAgent({
        phone: normalizedLead.phone,
        firstName: normalizedLead.firstName,
        lastName: normalizedLead.lastName,
        businessName: normalizedLead.businessName,
        email: normalizedLead.email,
        annualOpportunity: formattedAnnualOpportunity,
        primaryOpportunity,
        reportUrl,
      });
      trackEvent(ANALYTICS_EVENTS.roi_agent_triggered, {
        source: "assessment",
      });
    } catch (error) {
      console.error("Assessment Speed2Lead initial SMS failed:", error);
    }
  }

  return {
    ok: true,
    results: assessment,
    reportToken,
    reportUrl,
    persistenceAvailable: true,
  };
}
