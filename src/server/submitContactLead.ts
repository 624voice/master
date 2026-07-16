import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  resolveContactTrade,
  resolveContactWebsite,
  validateContactFields,
  validateLeadInfo,
} from "~/lib/lead/validateLead";
import { saveLead } from "~/server/leads";

type ContactLeadRequest = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  trade: string;
  otherTrade?: string;
  websiteOption: "has" | "none" | "";
  website?: string;
  fleetSize: string;
  message: string;
};

export const submitContactLead = createServerFn({ method: "POST" })
  .validator((data: ContactLeadRequest) => data)
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

    const normalizedLead = normalizeLeadInfo({
      firstName: data.firstName,
      lastName: data.lastName,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
    });

    await saveLead({
      ...normalizedLead,
      trade: resolveContactTrade(data.trade, data.otherTrade),
      website: resolveContactWebsite(data.websiteOption, data.website),
      fleetSize: data.fleetSize.trim(),
      message: data.message.trim(),
      source: "contact_form",
    });

    return { ok: true as const };
  });
