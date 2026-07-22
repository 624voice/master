import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  resolveContactTrade,
  resolveContactWebsite,
  validateContactFields,
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { saveLead } from "~/server/leads";
import { markDemoFormSubmitted, hasUsedVoiceDemo } from "~/server/vapi/demoUsage";

export type DemoLead = LeadInfo & {
  website: string;
  trade: string;
  fleetSize: string;
  message: string;
  smsConsent: boolean;
};

type DemoLeadRequest = LeadInfo & {
  trade: string;
  otherTrade?: string;
  websiteOption: "has" | "none" | "";
  website?: string;
  fleetSize: string;
  message: string;
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

    const contactError = validateContactFields({
      trade: data.trade,
      otherTrade: data.otherTrade,
      websiteOption: data.websiteOption,
      website: data.website,
      fleetSize: data.fleetSize,
      message: data.message,
    });
    if (contactError) {
      throw new Error(contactError);
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
    const trade = resolveContactTrade(data.trade, data.otherTrade);

    const demoAlreadyUsed = await hasUsedVoiceDemo(
      normalizedLead.email,
      normalizedLead.phone,
    );

    const lead: DemoLead = {
      ...normalizedLead,
      website,
      trade,
      fleetSize: data.fleetSize.trim(),
      message: data.message.trim(),
      smsConsent: data.smsConsent,
    };

    if (demoAlreadyUsed) {
      return { ok: true as const, lead, demoAlreadyUsed: true };
    }

    await saveLead({
      ...normalizedLead,
      trade,
      website,
      fleetSize: data.fleetSize.trim(),
      message: data.message.trim(),
      smsConsent: data.smsConsent,
      source: "voice_demo",
    });

    await markDemoFormSubmitted(normalizedLead.email, normalizedLead.phone);

    return { ok: true as const, lead, demoAlreadyUsed: false };
  });
