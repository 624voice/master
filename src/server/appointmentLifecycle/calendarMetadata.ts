import type { BookingAttributionSource, LeadIndexEntry } from "~/server/appointmentLifecycle/types";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";

export const S2L_ATTRIBUTION_START = "--- S2L ATTRIBUTION START ---";
export const S2L_ATTRIBUTION_END = "--- S2L ATTRIBUTION END ---";

export function formatAttributionSourceDisplay(source: BookingAttributionSource): string {
  return source.toUpperCase();
}

export function buildAttributionBlock(args: {
  brand: string;
  attributionSource: BookingAttributionSource;
  prospect?: string;
  business?: string;
  phone?: string;
  email?: string;
  context?: string;
}): string {
  const lines = [
    S2L_ATTRIBUTION_START,
    `Agent/Brand: ${args.brand}`,
    `Source: ${formatAttributionSourceDisplay(args.attributionSource)}`,
    args.prospect ? `Prospect: ${args.prospect}` : undefined,
    args.business ? `Business: ${args.business}` : undefined,
    args.phone ? `Phone: ${args.phone}` : undefined,
    args.email ? `Email: ${args.email}` : undefined,
    args.context ? `Context: ${args.context}` : undefined,
    S2L_ATTRIBUTION_END,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildAttributionBlockForLead(args: {
  lead: LeadIndexEntry;
  attributionSource: BookingAttributionSource;
  context?: string;
}): string {
  const brand = getActiveProfile().companyName;
  return buildAttributionBlock({
    brand,
    attributionSource: args.attributionSource,
    prospect: [args.lead.firstName, args.lead.lastName].filter(Boolean).join(" "),
    business: args.lead.businessName,
    phone: args.lead.phone,
    email: args.lead.email,
    context: args.context,
  });
}

export type AttributionUpsertResult = {
  description: string;
  malformed: boolean;
};

export function upsertAttributionBlock(
  existing: string | undefined,
  block: string,
): AttributionUpsertResult {
  const current = existing ?? "";
  const startIdx = current.indexOf(S2L_ATTRIBUTION_START);
  const endIdx = current.indexOf(S2L_ATTRIBUTION_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = current.slice(0, startIdx);
    const after = current.slice(endIdx + S2L_ATTRIBUTION_END.length);
    const joined = `${before}${block}${after}`.replace(/\n{3,}/g, "\n\n").trim();
    return { description: joined, malformed: false };
  }

  if (startIdx === -1 && endIdx === -1) {
    const joined = current.trim() ? `${current.trim()}\n\n${block}` : block;
    return { description: joined, malformed: false };
  }

  const joined = current.trim() ? `${current.trim()}\n\n${block}` : block;
  return { description: joined, malformed: true };
}
