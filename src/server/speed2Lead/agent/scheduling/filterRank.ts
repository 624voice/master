import { slotStartMinutes } from "~/server/speed2Lead/agent/scheduling/slotRanking";
import type { AvailabilityPreference, SchedulingRequest } from "~/server/speed2Lead/agent/scheduling/types";

const DEFAULT_MAX_OFFER = 3;
const DEFAULT_MIN_SEPARATION_MINUTES = 45;
const ANCHOR_RANK_TOLERANCE_MINUTES = 90;

function partOfDayForMinutes(minutes: number): "morning" | "afternoon" | "evening" {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 15 * 60) return "afternoon";
  return "evening";
}

function slotMatchesPreference(minutes: number, preference: AvailabilityPreference): boolean {
  if (preference === "full_day" || preference === "earliest" || preference === "exact_time") {
    return true;
  }
  if (preference === "evening") {
    return minutes >= 15 * 60;
  }
  if (preference === "afternoon") {
    return minutes >= 12 * 60 && minutes < 17 * 60;
  }
  return partOfDayForMinutes(minutes) === preference;
}

function slotMatchesBounds(minutes: number, request: SchedulingRequest): boolean {
  if (request.lowerTimeBound != null && minutes < request.lowerTimeBound) {
    return false;
  }
  if (request.upperTimeBound != null && minutes > request.upperTimeBound) {
    return false;
  }
  return true;
}

function sortByTime(slots: string[]): string[] {
  return [...slots].sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
}

function sortByAnchorProximity(slots: string[], anchorMinutes: number): string[] {
  return [...slots].sort((left, right) => {
    const leftMinutes = slotStartMinutes(left);
    const rightMinutes = slotStartMinutes(right);
    if (leftMinutes == null || rightMinutes == null) return 0;
    return Math.abs(leftMinutes - anchorMinutes) - Math.abs(rightMinutes - anchorMinutes);
  });
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
    if (!slotMatchesPreference(minutes, args.request.availabilityPreference)) return false;
    return slotMatchesBounds(minutes, args.request);
  });

  if (args.request.anchorTime != null) {
    candidates = sortByAnchorProximity(candidates, args.request.anchorTime).filter((slot) => {
      const minutes = slotStartMinutes(slot);
      if (minutes == null) return false;
      return Math.abs(minutes - args.request.anchorTime!) <= ANCHOR_RANK_TOLERANCE_MINUTES;
    });
  }

  if (args.request.availabilityPreference === "earliest") {
    return candidates.slice(0, maxOffer);
  }

  return pickSpreadSlots(candidates, maxOffer);
}

export { slotStartMinutes };
