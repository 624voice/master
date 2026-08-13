import { getLeadByEmail, getLeadsByPhone } from "~/server/appointmentLifecycle/store";
import type {
  LeadIndexEntry,
  MatchResult,
  NormalizedCalendarEvent,
} from "~/server/appointmentLifecycle/types";
import { tryNormalizePhone } from "~/server/sms/phone";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function namesAlign(eventName: string | undefined, lead: LeadIndexEntry): boolean {
  if (!eventName?.trim()) {
    return true;
  }
  const parts = eventName.trim().toLowerCase().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  const leadFirst = lead.firstName.trim().toLowerCase();
  const leadLast = lead.lastName?.trim().toLowerCase();
  if (first && leadFirst && first !== leadFirst) {
    return false;
  }
  if (last && leadLast && last !== leadLast) {
    return false;
  }
  return true;
}

async function matchByPhone(event: NormalizedCalendarEvent): Promise<MatchResult | null> {
  if (!event.attendeePhone) {
    return null;
  }

  const normalized = tryNormalizePhone(event.attendeePhone);
  if (!normalized) {
    return null;
  }

  const leads = await getLeadsByPhone(normalized);
  if (leads.length === 0) {
    return null;
  }

  if (leads.length === 1) {
    const lead = leads[0]!;
    if (!namesAlign(event.attendeeName, lead)) {
      return {
        matched: false,
        reason: "phone_name_mismatch",
        diagnostic: {
          eventId: event.calendarEventId,
          attendeePhone: normalized,
          attendeeName: event.attendeeName,
        },
      };
    }
    return { matched: true, lead, method: "phone", confidence: "high" };
  }

  // Shared office phone — require email disambiguation
  if (!event.attendeeEmail) {
    return {
      matched: false,
      reason: "ambiguous_phone_match",
      diagnostic: {
        eventId: event.calendarEventId,
        attendeePhone: normalized,
        candidateCount: String(leads.length),
      },
    };
  }

  const email = normalizeEmail(event.attendeeEmail);
  const lead = leads.find((l) => l.email && normalizeEmail(l.email) === email);
  if (!lead) {
    return {
      matched: false,
      reason: "ambiguous_phone_match",
      diagnostic: {
        eventId: event.calendarEventId,
        attendeePhone: normalized,
        attendeeEmail: email,
        candidateCount: String(leads.length),
      },
    };
  }

  if (!namesAlign(event.attendeeName, lead)) {
    return {
      matched: false,
      reason: "phone_email_name_mismatch",
      diagnostic: {
        eventId: event.calendarEventId,
        attendeePhone: normalized,
        attendeeEmail: email,
        attendeeName: event.attendeeName,
      },
    };
  }

  return { matched: true, lead, method: "phone", confidence: "high" };
}

async function matchByEmail(event: NormalizedCalendarEvent): Promise<MatchResult | null> {
  if (!event.attendeeEmail) {
    return null;
  }

  const lead = await getLeadByEmail(normalizeEmail(event.attendeeEmail));
  if (!lead) {
    return null;
  }

  if (!namesAlign(event.attendeeName, lead)) {
    return {
      matched: false,
      reason: "email_name_mismatch",
      diagnostic: {
        eventId: event.calendarEventId,
        attendeeEmail: event.attendeeEmail,
        attendeeName: event.attendeeName,
      },
    };
  }

  return { matched: true, lead, method: "email", confidence: "high" };
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

  const phoneMatch = await matchByPhone(event);
  if (phoneMatch) {
    return phoneMatch;
  }

  const emailMatch = await matchByEmail(event);
  if (emailMatch) {
    return emailMatch;
  }

  // Priority 3 — deterministic correlation ID (not available in current booking flow)

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
