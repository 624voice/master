import { createServerFn } from "@tanstack/react-start";
import type { RunAssessmentResult } from "~/lib/assessment/runAssessment";
import type { LeadInfo } from "~/lib/lead/validateLead";

export type AssessmentLeadRequest = {
  lead: LeadInfo;
  smsConsent: boolean;
  idempotencyKey: string;
  answers: Record<string, unknown>;
};

export type AssessmentLeadSuccess = {
  ok: true;
  results: RunAssessmentResult;
  reportToken?: string;
  reportUrl?: string;
  persistenceAvailable: boolean;
  message?: string;
};

export type StartAssessmentRoiAgentInput = {
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
};

export const submitAssessmentLead = createServerFn({ method: "POST" })
  .validator((data: AssessmentLeadRequest) => data)
  .handler(async ({ data }) => {
    const { submitAssessmentLeadHandler } = await import(
      "~/server/submitAssessmentLead.server"
    );
    return submitAssessmentLeadHandler(data);
  });
