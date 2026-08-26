/**
 * Thin scheduling wrapper for the rebuilt agent.
 *
 * This intentionally does almost nothing new: it calls the existing,
 * well-tested calendar layer (`getConsultationSlots`, `bookConsultation`) and
 * just shapes the result for the LLM turn engine. There is no second
 * scheduling state machine here, no free-text date parsing — the LLM is
 * shown a numbered list of REAL slots and can only ever pick from that list.
 */
import { bookConsultation } from "~/server/appointmentLifecycle/bookConsultation";
import { getConsultationSlots } from "~/server/appointmentLifecycle/googleCalendar";
import { formatNaturalAppointmentParts } from "~/server/appointmentLifecycle/formatTime";
import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { OfferedSlot } from "~/server/speed2Lead/agent/state";

const SLOT_SEARCH_WINDOW_DAYS = 10;
const MAX_OFFERED_SLOTS = 6;

export type SlotFetchResult =
  | { ok: true; slots: OfferedSlot[] }
  | { ok: false; reason: string };

function labelForSlot(iso: string, timezone: string): string {
  const parts = formatNaturalAppointmentParts(iso, timezone);
  const tz = parts.timezoneShort ? ` ${parts.timezoneShort}` : "";
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.time}${tz}`;
}

/**
 * Fetch real availability and return a short, spread-out list of options
 * (not just the next 6 back-to-back slots) so the prospect sees genuine
 * variety across the next ~10 business days.
 */
export async function offerSlots(profile: AgentProfile): Promise<SlotFetchResult> {
  const now = new Date();
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + SLOT_SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const result = await getConsultationSlots({
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    maxSlots: 200,
    now,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const spread = spreadAcrossDays(result.slots, MAX_OFFERED_SLOTS);
  return {
    ok: true,
    slots: spread.map((iso) => ({ startIso: iso, label: labelForSlot(iso, profile.timezone) })),
  };
}

/** Pick at most `max` slots, preferring one-per-day spread over consecutive times. */
export function spreadAcrossDays(candidates: string[], max: number): string[] {
  const byDay = new Map<string, string[]>();
  for (const iso of candidates) {
    const day = iso.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(iso);
    byDay.set(day, list);
  }

  const days = [...byDay.keys()];
  const picked: string[] = [];
  let round = 0;
  while (picked.length < max && days.some((day) => (byDay.get(day)?.length ?? 0) > round)) {
    for (const day of days) {
      const list = byDay.get(day) ?? [];
      if (list[round]) picked.push(list[round]);
      if (picked.length >= max) break;
    }
    round += 1;
  }
  return picked;
}

export type BookSlotResult =
  | {
      ok: true;
      eventId: string;
      startIso: string;
      meetUrl: string;
      /** False when lifecycle skipped confirmation (e.g. idempotent replay). */
      confirmationSmsSent: boolean;
    }
  | { ok: false; reason: string };

export async function confirmBookSlot(input: {
  slot: OfferedSlot;
  phone: string;
  attendeeName: string;
  attendeeEmail?: string;
  businessName?: string;
}): Promise<BookSlotResult> {
  const result = await bookConsultation({
    start: input.slot.startIso,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    phone: input.phone,
    businessName: input.businessName,
    source: "roi",
  });

  if (!result.ok || !("selectedStart" in result)) {
    const reason = "reason" in result ? result.reason : "booking_failed";
    return { ok: false, reason };
  }

  return {
    ok: true,
    eventId: result.eventId,
    startIso: result.selectedStart,
    meetUrl: result.googleMeetUrl,
    confirmationSmsSent: Boolean(result.lifecycle.smsSent),
  };
}
