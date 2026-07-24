import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  resolveContactWebsite,
  validateDemoLeadIdentity,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { saveLead } from "~/server/leads";
import { markDemoFormSubmitted, hasUsedVoiceDemo } from "~/server/vapi/demoUsage";

export type DemoLead = LeadInfo & {
  website: string;
  smsConsent: boolean;
};

type DemoLeadRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  websiteOption: "has" | "none" | "";
  website?: string;
  smsConsent: boolean;
};

function validateDemoLeadFields(data: DemoLeadRequest): string | null {
  const leadError = validateDemoLeadIdentity({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
  });
  if (leadError) {
    return leadError;
  }

  return validateWebsiteFields(data.websiteOption, data.website);
}

export const submitDemoLead = createServerFn({ method: "POST" })
  .validator((data: DemoLeadRequest) => data)
  .handler(async ({ data }) => {
    const fieldError = validateDemoLeadFields(data);
    if (fieldError) {
      throw new Error(fieldError);
    }

    const normalizedLead = normalizeLeadInfo({
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
      email: data.email,
      phone: data.phone,
    });

    const website = resolveContactWebsite(data.websiteOption, data.website);

    const demoAlreadyUsed = await hasUsedVoiceDemo(
      normalizedLead.email,
      normalizedLead.phone,
    );

    const lead: DemoLead = {
      ...normalizedLead,
      website,
      smsConsent: data.smsConsent,
    };

    if (demoAlreadyUsed) {
      return { ok: true as const, lead, demoAlreadyUsed: true };
    }

    await saveLead({
      ...normalizedLead,
      trade: "Voice Demo",
      website,
      fleetSize: "",
      message: "Live AI demo",
      smsConsent: data.smsConsent,
      source: "voice_demo",
    });

    await markDemoFormSubmitted(normalizedLead.email, normalizedLead.phone);

    return { ok: true as const, lead, demoAlreadyUsed: false };
  });
