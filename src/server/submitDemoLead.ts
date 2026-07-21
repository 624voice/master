import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  resolveContactWebsite,
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { saveLead } from "~/server/leads";

export type DemoLead = LeadInfo & {
  website: string;
  smsConsent: boolean;
};

type DemoLeadRequest = LeadInfo & {
  websiteOption: "has" | "none" | "";
  website?: string;
  smsConsent: boolean;
};

export const submitDemoLead = createServerFn({ method: "POST" })
  .validator((data: DemoLeadRequest) => data)
  .handler(async ({ data }) => {
    const leadError = validateLeadInfo({
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
    });
    if (leadError) {
      throw new Error(leadError);
    }

    const websiteError = validateWebsiteFields(data.websiteOption, data.website);
    if (websiteError) {
      throw new Error(websiteError);
    }

    const normalizedLead = normalizeLeadInfo({
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
    });

    const website = resolveContactWebsite(data.websiteOption, data.website);

    await saveLead({
      ...normalizedLead,
      website,
      smsConsent: data.smsConsent,
      source: "voice_demo",
    });

    const lead: DemoLead = {
      ...normalizedLead,
      website,
      smsConsent: data.smsConsent,
    };

    return { ok: true as const, lead };
  });
