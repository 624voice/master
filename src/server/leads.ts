import {
  normalizeLeadInfo,
  validateLeadInfo,
  type LeadInfo,
} from "~/lib/lead/validateLead";

export type LeadPayload = LeadInfo & {
  firstName?: string;
  lastName?: string;
  trade?: string;
  monthlyCalls?: number;
  truckCount?: number;
  fleetSize?: string;
  message?: string;
  website?: string;
  source: string;
};

const savedEmails = new Set<string>();

/**
 * POST lead JSON to LEADS_WEBHOOK_URL (server-only env — no VITE_ prefix).
 * Point the webhook at Zapier, HubSpot, n8n, email, etc. No DB dependency.
 */
export async function saveLead(payload: LeadPayload): Promise<void> {
  const url = process.env.LEADS_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "LEADS_WEBHOOK_URL is not configured. Set it in your server environment to capture leads.",
    );
  }

  const normalized = normalizeLeadInfo(payload);
  const emailKey = normalized.email.toLowerCase();

  if (savedEmails.has(emailKey)) {
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: normalized.name,
      firstName: payload.firstName,
      lastName: payload.lastName,
      businessName: normalized.businessName,
      email: normalized.email,
      phone: normalized.phone,
      trade: payload.trade,
      monthlyCalls: payload.monthlyCalls,
      truckCount: payload.truckCount,
      fleetSize: payload.fleetSize,
      message: payload.message,
      website: payload.website,
      source: payload.source,
      capturedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Lead webhook failed with status ${response.status}`);
  }

  savedEmails.add(emailKey);
}
