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

let harnessOfferSlotsOverride: ((profile: AgentProfile) => Promise<SlotFetchResult>) | null = null;
let harnessRawSlotsOverride: ((profile: AgentProfile) => Promise<RawSlotFetchResult>) | null = null;
let harnessFetchFailureOverride: (() => RawSlotFetchResult) | null = null;

/** Test harness only — force calendar fetch failure (local provider-failure scenarios). */
export function setHarnessFetchFailureOverride(override: (() => RawSlotFetchResult) | null): void {
  harnessFetchFailureOverride = override;
}

export type RawSlotFetchResult =
  | { ok: true; slots: string[] }
  | { ok: false; reason: string };

/** Test harness only — inject deterministic slots without Google Calendar. */
export function setHarnessOfferSlotsOverride(
  override: ((profile: AgentProfile) => Promise<SlotFetchResult>) | null,
  rawOverride?: ((profile: AgentProfile) => Promise<RawSlotFetchResult>) | null,
): void {
  harnessOfferSlotsOverride = override;
  harnessRawSlotsOverride = rawOverride ?? null;
}

/** Fetch raw slot ISOs — respects harness override when set. */
export async function fetchRawConsultationSlots(
  profile: AgentProfile,
  args: {
    rangeStart: string;
    rangeEnd: string;
    maxSlots?: number;
    now?: Date;
  },
): Promise<RawSlotFetchResult> {
  if (harnessFetchFailureOverride) {
    return harnessFetchFailureOverride();
  }
  if (harnessRawSlotsOverride) {
    return harnessRawSlotsOverride(profile);
  }
  if (harnessOfferSlotsOverride) {
    const offered = await harnessOfferSlotsOverride(profile);
    if (!offered.ok) return offered;
    return { ok: true, slots: offered.slots.map((slot) => slot.startIso) };
  }

  const result = await getConsultationSlots({
    rangeStart: args.rangeStart,
    rangeEnd: args.rangeEnd,
    maxSlots: args.maxSlots ?? 200,
    now: args.now ?? new Date(),
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, slots: result.slots };
}

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
  if (harnessFetchFailureOverride) {
    return harnessFetchFailureOverride();
  }
  if (harnessOfferSlotsOverride) {
    return harnessOfferSlotsOverride(profile);
  }

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
  source?: "roi" | "contact";
}): Promise<BookSlotResult> {
  const result = await bookConsultation({
    start: input.slot.startIso,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    phone: input.phone,
    businessName: input.businessName,
    source: input.source ?? "roi",
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
