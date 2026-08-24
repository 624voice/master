import { slotStartMinutes } from "~/server/speed2Lead/slotRanking";
import type { AvailabilityPreference, SchedulingRequest } from "~/server/scheduling/types";

const DEFAULT_MAX_OFFER = 3;
const DEFAULT_MIN_SEPARATION_MINUTES = 45;

function partOfDayForMinutes(minutes: number): "morning" | "afternoon" | "evening" {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

function slotMatchesPreference(minutes: number, preference: AvailabilityPreference): boolean {
  if (preference === "full_day" || preference === "earliest" || preference === "exact_time") {
    return true;
  }
  return partOfDayForMinutes(minutes) === preference;
}

function sortByTime(slots: string[]): string[] {
  return [...slots].sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
}

function pickSpreadSlots(candidates: string[], maxOffer: number): string[] {
  if (candidates.length <= maxOffer) return candidates;
  const picked: string[] = [candidates[0]!];
  const minSepMs = DEFAULT_MIN_SEPARATION_MINUTES * 60_000;
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
      if (!picked.includes(slot)) picked.push(slot);
    }
  }
  return sortByTime(picked.slice(0, maxOffer));
}

/** Single filter/rank pass for a normalized scheduling request. */
export function filterAndRankSlots(args: {
  rawSlots: string[];
  request: SchedulingRequest;
  maxOffer?: number;
}): string[] {
  const maxOffer = args.maxOffer ?? DEFAULT_MAX_OFFER;
  let candidates = sortByTime(args.rawSlots);

  if (args.request.availabilityPreference === "exact_time" && args.request.exactTimeMinutes != null) {
    const exact = candidates.filter(
      (slot) => slotStartMinutes(slot) === args.request.exactTimeMinutes,
    );
    return exact.slice(0, 1);
  }

  candidates = candidates.filter((slot) => {
    const minutes = slotStartMinutes(slot);
    if (minutes === null) return false;
    return slotMatchesPreference(minutes, args.request.availabilityPreference);
  });

  if (args.request.availabilityPreference === "earliest") {
    return candidates.slice(0, maxOffer);
  }

  return pickSpreadSlots(candidates, maxOffer);
}

export { slotStartMinutes };
