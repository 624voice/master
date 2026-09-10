import type { LeadInfo } from "~/lib/lead/validateLead";

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Personalization line for page 1 — omits junk placeholders. */
export function formatPreparedForLine(lead: LeadInfo): string {
  const first = trim(lead.firstName);
  const last = trim(lead.lastName);
  const business = trim(lead.businessName);

  let namePart = "";
  if (first && last) {
    namePart = `${first} ${last}`;
  } else if (first) {
    namePart = first;
  } else if (last) {
    namePart = last;
  }

  if (!namePart) {
    return "";
  }

  if (business.length >= 2) {
    return `Prepared for ${namePart} · ${business}`;
  }

  return `Prepared for ${namePart}`;
}
