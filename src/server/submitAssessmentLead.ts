import { createServerFn } from "@tanstack/react-start";
import {
  ASSESSMENT_ROI_AGENT_LIVE_ENABLED,
  FEATURE_FLAGS,
} from "~/config/features";
import {
  ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED,
  ANALYTICS_EVENT_ASSESSMENT_SUBMITTED,
  trackEvent,
} from "~/lib/analytics/trackEvent";
import {
  normalizeLeadInfo,
  resolveContactWebsite,
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { TRADES, type TradeKey } from "~/lib/roi/roiModel";
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
import { getPrimaryOpportunity } from "~/server/speed2Lead/roiOpportunity";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";

export type AssessmentLeadRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
  smsConsent: boolean;
  idempotencyKey?: string;
};

export type AssessmentLeadResponse = {
  ok: true;
  reportToken: string;
  reportUrl: string;
  snapshot: AssessmentReportSnapshot;
  idempotencyCase: string;
  replaySubstate: string;
  replayed: boolean;
};

type StartAssessmentRoiAgentInput = {
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
};

export async function startAssessmentRoiAgent(
  input: StartAssessmentRoiAgentInput,
): Promise<void> {
  await startAgentConversation(input);
}

async function submitAssessmentLeadHandler(
  data: AssessmentLeadRequest,
): Promise<AssessmentLeadResponse> {
  if (!FEATURE_FLAGS.ASSESSMENT_ENABLED) {
    throw new Error("Assessment submissions are disabled.");
  }

  const leadError = validateLeadInfo(data.lead);
  if (leadError) {
    throw new Error(leadError);
  }

  const websiteError = validateWebsiteFields(data.websiteOption, data.website);
  if (websiteError) {
    throw new Error(websiteError);
  }

  if (!TRADES[data.trade]) {
    throw new Error("Invalid trade");
  }

  const normalizedLead = normalizeLeadInfo(data.lead);
  const clientIp = getTrustedClientIp();
  const idempotencyKey =
    data.idempotencyKey?.trim() ||
    buildAssessmentPayloadHash(
      JSON.stringify({
        trade: data.trade,
        truckCount: data.truckCount,
        monthlyCalls: data.monthlyCalls,
        lead: normalizedLead,
        websiteOption: data.websiteOption,
        website: data.website ?? "",
      }),
    );

  const sourceLimit = await checkAssessmentSourceRateLimit({
    clientIp,
  });
  if (!sourceLimit.allowed) {
    trackEvent(ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED, {
      source: "assessment_form",
      limitType: "source",
      count: sourceLimit.count,
    });
    throw new Error("Too many assessment requests. Please try again later.");
  }

  const scenarios = computeAllScenarios(data.trade, data.monthlyCalls);
  const moderateRoi = formatCurrency(scenarios[1]!.totalAnnualBenefit);
  const primaryOpportunity = getPrimaryOpportunity(scenarios);
  const reportGeneratedAt = new Date().toISOString();

  const snapshot: AssessmentReportSnapshot = {
    trade: data.trade,
    truckCount: data.truckCount,
    monthlyCalls: data.monthlyCalls,
    lead: normalizedLead,
    websiteOption: data.websiteOption,
    website: data.websiteOption === "has" ? data.website : undefined,
    scenarios,
    moderateAnnualBenefit: scenarios[1]!.totalAnnualBenefit,
    primaryOpportunity,
    reportGeneratedAt,
  };

  const payloadHash = buildAssessmentPayloadHash(JSON.stringify(snapshot));
  const cachedResponsePlaceholder = JSON.stringify({ ok: true });

  const phoneLimit = await checkAssessmentPhoneIdempotency({
    phone: normalizedLead.phone,
    idempotencyKey,
    payloadHash,
    cachedResponse: cachedResponsePlaceholder,
  });

  if (!phoneLimit.allowed) {
    trackEvent(ANALYTICS_EVENT_ASSESSMENT_RATE_LIMITED, {
      source: "assessment_form",
      limitType: "phone",
      count: phoneLimit.count,
      idempotencyCase: phoneLimit.case,
      replaySubstate: phoneLimit.substate,
    });
    throw new Error("This phone number has reached the daily assessment limit.");
  }

  const replayed = phoneLimit.substate === "replay_exact";

  if (!replayed) {
    await saveLead({
      ...normalizedLead,
      trade: TRADES[data.trade].label,
      monthlyCalls: data.monthlyCalls,
      truckCount: data.truckCount,
      fleetSize: String(data.truckCount),
      website: resolveContactWebsite(data.websiteOption, data.website),
      moderateRoi,
      smsConsent: data.smsConsent,
      source: "assessment",
    });
  }

  const reportToken = await createAssessmentReportToken({ snapshot });
  const reportUrl = buildAssessmentReportUrl(reportToken);

  if (
    data.smsConsent &&
    ASSESSMENT_ROI_AGENT_LIVE_ENABLED &&
    isSpeed2LeadEnabled() &&
    !replayed
  ) {
    try {
      await startAssessmentRoiAgent({
        phone: normalizedLead.phone,
        firstName: normalizedLead.firstName,
        lastName: normalizedLead.lastName,
        businessName: normalizedLead.businessName,
        email: normalizedLead.email,
        annualOpportunity: moderateRoi,
        primaryOpportunity,
        reportUrl,
      });
    } catch (error) {
      console.error("Assessment Speed2Lead initial SMS failed:", error);
    }
  }

  trackEvent(ANALYTICS_EVENT_ASSESSMENT_SUBMITTED, {
    source: "assessment_form",
    trade: data.trade,
    idempotencyCase: phoneLimit.case,
    replaySubstate: phoneLimit.substate,
  });

  return {
    ok: true,
    reportToken,
    reportUrl,
    snapshot,
    idempotencyCase: phoneLimit.case,
    replaySubstate: phoneLimit.substate,
    replayed,
  };
}

export const submitAssessmentLead = createServerFn({ method: "POST" })
  .validator((data: AssessmentLeadRequest) => data)
  .handler(async ({ data }) => submitAssessmentLeadHandler(data));

export { submitAssessmentLeadHandler };
