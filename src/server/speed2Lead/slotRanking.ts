import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { SchedulingPartOfDay } from "~/server/speed2Lead/sessionMemoryTypes";

export type SlotRankPreferences = {
  partOfDay?: SchedulingPartOfDay;
  anchorMinutes?: number;
  searchAfterMinutes?: number;
  searchBeforeMinutes?: number;
  minSeparationMinutes?: number;
  maxOffer?: number;
  /** When true, pick slots closest to anchor rather than spread across window. */
  narrowAroundAnchor?: boolean;
};

const DEFAULT_MIN_SEPARATION_MINUTES = 45;
const DEFAULT_MAX_OFFER = 3;

export function slotStartMinutes(iso: string): number | null {
  const { time } = formatTimeOnly(iso, CONSULTATION_TIMEZONE);
  return parseClockToMinutes(time);
}

export function parseClockToMinutes(raw: string): number | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  let meridiem = (match[3] ?? "").toLowerCase();
  if (!meridiem) {
    meridiem = hour >= 8 && hour <= 11 ? "am" : "pm";
  }
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour >= 24 || minute >= 60) return null;
  return hour * 60 + minute;
}

function sortByTime(slots: string[]): string[] {
  return [...slots].sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
}

function pickSpreadSlots(
  candidates: string[],
  maxOffer: number,
  minSeparationMinutes: number,
): string[] {
  if (candidates.length <= maxOffer) {
    return candidates;
  }

  const picked: string[] = [candidates[0]!];
  const minSepMs = minSeparationMinutes * 60_000;

  for (const slot of candidates.slice(1)) {
    if (picked.length >= maxOffer) break;
    const slotMs = new Date(slot).getTime();
    if (picked.every((existing) => Math.abs(new Date(existing).getTime() - slotMs) >= minSepMs)) {
      picked.push(slot);
    }
  }

  if (picked.length < maxOffer) {
    for (const slot of candidates) {
      if (picked.length >= maxOffer) break;
      if (!picked.includes(slot)) {
        picked.push(slot);
      }
    }
  }

  return sortByTime(picked.slice(0, maxOffer));
}

function pickClosestToAnchor(
  candidates: string[],
  anchorMinutes: number,
  maxOffer: number,
): string[] {
  return [...candidates]
    .sort((left, right) => {
      const leftDelta = Math.abs((slotStartMinutes(left) ?? anchorMinutes) - anchorMinutes);
      const rightDelta = Math.abs((slotStartMinutes(right) ?? anchorMinutes) - anchorMinutes);
      return leftDelta - rightDelta;
    })
    .slice(0, maxOffer);
}

/** Choose human-useful slot options from real calendar availability. */
export function rankSlotsForOffer(
  allSlots: string[],
  preferences: SlotRankPreferences = {},
): string[] {
  const maxOffer = preferences.maxOffer ?? DEFAULT_MAX_OFFER;
  const minSeparationMinutes =
    preferences.minSeparationMinutes ?? DEFAULT_MIN_SEPARATION_MINUTES;

  let candidates = sortByTime(allSlots);
  if (candidates.length === 0) return [];

  if (preferences.searchAfterMinutes != null) {
    candidates = candidates.filter(
      (slot) => (slotStartMinutes(slot) ?? 0) > preferences.searchAfterMinutes!,
    );
  }

  if (preferences.searchBeforeMinutes != null) {
    candidates = candidates.filter(
      (slot) => (slotStartMinutes(slot) ?? 0) < preferences.searchBeforeMinutes!,
    );
  }

  if (candidates.length === 0) {
    return [];
  }

  if (preferences.narrowAroundAnchor && preferences.anchorMinutes != null) {
    return pickClosestToAnchor(candidates, preferences.anchorMinutes, maxOffer);
  }

  if (preferences.anchorMinutes != null && candidates.length > maxOffer) {
    const closest = pickClosestToAnchor(candidates, preferences.anchorMinutes, maxOffer);
    if (closest.length >= Math.min(maxOffer, candidates.length)) {
      return sortByTime(closest);
    }
  }

  return pickSpreadSlots(candidates, maxOffer, minSeparationMinutes);
}

export function latestOfferedMinutes(offeredSlots: string[]): number | null {
  if (offeredSlots.length === 0) return null;
  const minutes = offeredSlots
    .map((slot) => slotStartMinutes(slot))
    .filter((value): value is number => value !== null);
  if (minutes.length === 0) return null;
  return Math.max(...minutes);
}

export function earliestOfferedMinutes(offeredSlots: string[]): number | null {
  if (offeredSlots.length === 0) return null;
  const minutes = offeredSlots
    .map((slot) => slotStartMinutes(slot))
    .filter((value): value is number => value !== null);
  if (minutes.length === 0) return null;
  return Math.min(...minutes);
}
