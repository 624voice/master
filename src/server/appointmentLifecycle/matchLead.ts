import {
  findRecentLeadsByName,
  getLeadByEmail,
  getLeadByPhone,
} from "~/server/appointmentLifecycle/store";
import type {
  LeadIndexEntry,
  MatchResult,
  NormalizedCalendarEvent,
} from "~/server/appointmentLifecycle/types";
import { tryNormalizePhone } from "~/server/sms/phone";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function splitAttendeeName(name?: string): { firstName: string; lastName?: string } {
  if (!name?.trim()) {
    return { firstName: "" };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0]! };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function isRecentLead(entry: LeadIndexEntry, maxAgeMs = 30 * 24 * 60 * 60 * 1000): boolean {
  const age = Date.now() - new Date(entry.registeredAt).getTime();
  return age >= 0 && age <= maxAgeMs;
}

export async function matchCalendarEventToLead(
  event: NormalizedCalendarEvent,
): Promise<MatchResult> {
  const diagnostic: Record<string, string | undefined> = {
    eventId: event.calendarEventId,
    attendeeEmail: event.attendeeEmail,
    attendeePhone: event.attendeePhone,
    attendeeName: event.attendeeName,
  };

  // Priority 1 — phone
  if (event.attendeePhone) {
    const normalized = tryNormalizePhone(event.attendeePhone);
    if (normalized) {
      const lead = await getLeadByPhone(normalized);
      if (lead) {
        return { matched: true, lead, method: "phone", confidence: "high" };
      }
    }
  }

  // Priority 2 — email
  if (event.attendeeEmail) {
    const lead = await getLeadByEmail(normalizeEmail(event.attendeeEmail));
    if (lead) {
      return { matched: true, lead, method: "email", confidence: "high" };
    }
  }

  // Priority 3 — correlation (none available in current booking flow)

  // Priority 4 — name (conservative)
  if (event.attendeeName) {
    const { firstName, lastName } = splitAttendeeName(event.attendeeName);
    if (firstName) {
      const candidates = (await findRecentLeadsByName(firstName, lastName)).filter(isRecentLead);
      if (candidates.length === 1) {
        const only = candidates[0]!;
        if (
          !event.attendeeEmail ||
          !only.email ||
          normalizeEmail(only.email) === normalizeEmail(event.attendeeEmail)
        ) {
          return { matched: true, lead: only, method: "name", confidence: "medium" };
        }
      }
      if (candidates.length > 1) {
        return {
          matched: false,
          reason: "ambiguous_name_match",
          diagnostic: { ...diagnostic, candidateCount: String(candidates.length) },
        };
      }
    }
  }

  return {
    matched: false,
    reason: "no_confident_match",
    diagnostic,
  };
}

export function extractPhoneFromText(text: string): string | undefined {
  const patterns = [
    /(?:phone|mobile|cell)(?:\s*(?:number|#))?\s*[:\-]?\s*(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i,
    /(\+1\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
    /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const normalized = tryNormalizePhone(match[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return undefined;
}

export function extractEmailFromText(text: string): string | undefined {
  const match = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return match?.[0]?.toLowerCase();
}
