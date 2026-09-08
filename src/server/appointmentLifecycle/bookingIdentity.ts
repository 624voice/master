/**
 * Layer 1: who booked (identity). Layer 2: which touch gets marketing credit
 * (attribution). Attribution never blocks the lifecycle and never rewrites
 * LeadIndexEntry.source or AgentSession.flow.
 */
import { getLeadByEmail, getLeadsByPhone } from "~/server/appointmentLifecycle/store";
import type {
  BookingAttributionConfidence,
  BookingAttributionSource,
  LeadIndexEntry,
  NormalizedCalendarEvent,
  S2LSource,
} from "~/server/appointmentLifecycle/types";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { tryNormalizePhone } from "~/server/sms/phone";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function leadIdentityKey(lead: LeadIndexEntry): string {
  return `${lead.phone}:${lead.email ?? ""}:${lead.source}:${lead.registeredAt}`;
}

function uniqueLeads(leads: LeadIndexEntry[]): LeadIndexEntry[] {
  const seen = new Set<string>();
  const out: LeadIndexEntry[] = [];
  for (const lead of leads) {
    const key = leadIdentityKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lead);
  }
  return out;
}

async function leadsMatchingEmail(email: string | undefined): Promise<LeadIndexEntry[]> {
  if (!email) return [];
  const byEmail = await getLeadByEmail(normalizeEmail(email));
  if (!byEmail) return [];
  const onPhone = await getLeadsByPhone(byEmail.phone);
  return onPhone.filter((l) => l.email && normalizeEmail(l.email) === normalizeEmail(email));
}

async function leadsMatchingPhone(phone: string | undefined): Promise<LeadIndexEntry[]> {
  if (!phone) return [];
  const normalized = tryNormalizePhone(phone);
  if (!normalized) return [];
  return getLeadsByPhone(normalized);
}

export type BookingIdentityResult =
  | { status: "unmatched" }
  | { status: "ambiguous"; emailPhones: string[]; phonePhones: string[] }
  | { status: "confirmed"; candidates: LeadIndexEntry[]; method: "phone" | "email" | "both" | "correlation" };

export async function resolveBookingIdentity(event: NormalizedCalendarEvent): Promise<BookingIdentityResult> {
  const emailMatched = await leadsMatchingEmail(event.attendeeEmail);
  const phoneMatched = await leadsMatchingPhone(event.attendeePhone);

  if (emailMatched.length === 0 && phoneMatched.length === 0) {
    return { status: "unmatched" };
  }

  const emailPhones = [...new Set(emailMatched.map((l) => l.phone))];
  const phonePhones = [...new Set(phoneMatched.map((l) => l.phone))];
  const overlap = emailPhones.filter((p) => phonePhones.includes(p));

  if (emailPhones.length > 0 && phonePhones.length > 0 && overlap.length === 0) {
    logAppointmentEvent("identity_match_ambiguous", {
      eventId: event.calendarEventId,
      emailPhones: emailPhones.join(","),
      phonePhones: phonePhones.join(","),
    });
    return { status: "ambiguous", emailPhones, phonePhones };
  }

  const candidates = uniqueLeads([...emailMatched, ...phoneMatched]);
  const method: "phone" | "email" | "both" | "correlation" =
    emailMatched.length > 0 && phoneMatched.length > 0
      ? "both"
      : emailMatched.length > 0
        ? "email"
        : "phone";

  logAppointmentEvent("identity_match_confirmed", {
    eventId: event.calendarEventId,
    phone: candidates[0]?.phone,
    candidateCount: candidates.length,
    method,
  });

  return { status: "confirmed", candidates, method };
}

export type BookingAttributionResult = {
  bookingAttributionSource: BookingAttributionSource;
  bookingAttributionConfidence: BookingAttributionConfidence;
  attributedLead?: LeadIndexEntry;
};

function eventCreatedAt(event: NormalizedCalendarEvent): string {
  return event.createdAt ?? event.updatedAt;
}

function withinAttributionWindow(sentAt: string, createdAt: string, windowDays: number): boolean {
  const sent = new Date(sentAt).getTime();
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(sent) || !Number.isFinite(created)) return false;
  if (sent > created) return false;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return created - sent <= windowMs;
}

export function attributeBooking(
  candidates: LeadIndexEntry[],
  event: NormalizedCalendarEvent,
  windowDays = getActiveProfile().bookingAttributionWindowDays,
): BookingAttributionResult {
  const createdAt = eventCreatedAt(event);
  const eligible = candidates.filter(
    (c) => c.bookingLinkSentAt && withinAttributionWindow(c.bookingLinkSentAt, createdAt, windowDays),
  );

  const sorted = [...eligible].sort(
    (a, b) => new Date(b.bookingLinkSentAt!).getTime() - new Date(a.bookingLinkSentAt!).getTime(),
  );

  if (sorted.length === 1) {
    const winner = sorted[0]!;
    logAppointmentEvent("booking_source_attributed", {
      eventId: event.calendarEventId,
      source: winner.source,
      confidence: "confident",
    });
    return {
      bookingAttributionSource: winner.source,
      bookingAttributionConfidence: "confident",
      attributedLead: winner,
    };
  }

  if (sorted.length >= 2) {
    const top = new Date(sorted[0]!.bookingLinkSentAt!).getTime();
    const tied = sorted.filter((c) => new Date(c.bookingLinkSentAt!).getTime() === top);
    const sources = new Set(tied.map((c) => c.source));
    if (tied.length === 1 && sources.size === 1) {
      const winner = tied[0]!;
      logAppointmentEvent("booking_source_attributed", {
        eventId: event.calendarEventId,
        source: winner.source,
        confidence: "confident",
      });
      return {
        bookingAttributionSource: winner.source,
        bookingAttributionConfidence: "confident",
        attributedLead: winner,
      };
    }
    logAppointmentEvent("booking_source_ambiguous", {
      eventId: event.calendarEventId,
      reason: "multi_touch",
    });
    return {
      bookingAttributionSource: "multi_touch",
      bookingAttributionConfidence: "ambiguous",
    };
  }

  // No link history in-window — correlation fallback may attribute only if
  // exactly one plausible historical source exists among the matched records.
  const historicalSources = new Set(candidates.map((c) => c.source));
  if (historicalSources.size === 1) {
    const only = candidates[0]!;
    logAppointmentEvent("booking_source_attributed", {
      eventId: event.calendarEventId,
      source: only.source,
      confidence: "confident",
      method: "correlation_fallback",
    });
    return {
      bookingAttributionSource: only.source,
      bookingAttributionConfidence: "confident",
      attributedLead: only,
    };
  }
  if (historicalSources.size > 1) {
    logAppointmentEvent("booking_source_ambiguous", {
      eventId: event.calendarEventId,
      reason: "multi_touch_no_link_history",
    });
    return {
      bookingAttributionSource: "multi_touch",
      bookingAttributionConfidence: "ambiguous",
    };
  }

  logAppointmentEvent("booking_source_ambiguous", {
    eventId: event.calendarEventId,
    reason: "unknown",
  });
  return {
    bookingAttributionSource: "unknown",
    bookingAttributionConfidence: "unattributed",
  };
}

/** Representative lead for lifecycle fields — never mutates source. */
export function pickRepresentativeLead(
  candidates: LeadIndexEntry[],
  attribution: BookingAttributionResult,
): LeadIndexEntry {
  if (attribution.attributedLead) {
    return attribution.attributedLead;
  }
  return [...candidates].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
  )[0]!;
}

export function isS2LSource(value: string): value is S2LSource {
  return value === "roi" || value === "contact" || value === "demo";
}
