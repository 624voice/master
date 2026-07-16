import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  validateLeadInfo,
} from "~/lib/lead/validateLead";
import { saveLead } from "~/server/leads";

type ContactLeadRequest = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  fleetSize?: string;
  message?: string;
};

export const submitContactLead = createServerFn({ method: "POST" })
  .validator((data: ContactLeadRequest) => data)
  .handler(async ({ data }) => {
    const name = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

    const leadError = validateLeadInfo({
      name,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
    });
    if (leadError) {
      throw new Error(leadError);
    }

    const normalizedLead = normalizeLeadInfo({
      name,
      businessName: data.businessName,
      email: data.email,
      phone: data.phone,
    });

    await saveLead({
      ...normalizedLead,
      fleetSize: data.fleetSize?.trim() || undefined,
      message: data.message?.trim() || undefined,
      source: "contact_form",
    });

    return { ok: true as const };
  });
