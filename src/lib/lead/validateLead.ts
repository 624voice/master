export type LeadInfo = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
};

export const CONTACT_TRADES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Roofing",
  "Pest Control",
  "Other",
] as const;

export type ContactTrade = (typeof CONTACT_TRADES)[number];

export type ContactFields = {
  trade: string;
  otherTrade?: string;
  websiteOption: "has" | "none" | "";
  website?: string;
  fleetSize: string;
  message: string;
};

export function resolveContactTrade(trade: string, otherTrade?: string): string {
  if (trade === "Other") {
    return otherTrade?.trim() ?? "";
  }
  return trade.trim();
}

export function resolveContactWebsite(
  websiteOption: ContactFields["websiteOption"],
  website?: string,
): string {
  if (websiteOption === "none") {
    return "I don't have a website";
  }
  const value = website?.trim() ?? "";
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

export function validateWebsiteFields(
  websiteOption: "has" | "none" | "",
  website?: string,
): string | null {
  if (websiteOption !== "has" && websiteOption !== "none") {
    return "Please select a website option.";
  }
  if (websiteOption === "has") {
    const value = website?.trim() ?? "";
    if (!value) return "Website is required.";
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
    try {
      const parsed = new URL(withProtocol);
      if (!parsed.hostname.includes(".")) {
        return "Enter a valid website URL.";
      }
    } catch {
      return "Enter a valid website URL.";
    }
  }
  return null;
}

export function validateContactFields(fields: ContactFields): string | null {
  if (!fields.trade.trim()) return "Trade is required.";
  if (!CONTACT_TRADES.includes(fields.trade as ContactTrade)) {
    return "Select a valid trade.";
  }
  if (fields.trade === "Other" && !fields.otherTrade?.trim()) {
    return "Please enter your trade.";
  }
  const websiteError = validateWebsiteFields(
    fields.websiteOption,
    fields.website,
  );
  if (websiteError) return websiteError;
  if (!fields.fleetSize.trim()) return "Fleet size is required.";
  if (!fields.message.trim()) return "Please tell us what we can help with.";
  return null;
}

export function validateLeadInfo(lead: LeadInfo): string | null {
  if (!lead.name.trim()) return "Name is required.";
  if (!lead.businessName.trim()) return "Business name is required.";
  if (!lead.email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) {
    return "Enter a valid email address.";
  }
  if (!lead.phone.trim()) return "Phone number is required.";
  const digits = lead.phone.replace(/\D/g, "");
  if (digits.length < 10) return "Enter a valid phone number.";
  return null;
}

export function normalizeLeadInfo(lead: LeadInfo): LeadInfo {
  return {
    name: lead.name.trim(),
    businessName: lead.businessName.trim(),
    email: lead.email.trim().toLowerCase(),
    phone: lead.phone.trim(),
  };
}
