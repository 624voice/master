export type LeadInfo = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
};

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
