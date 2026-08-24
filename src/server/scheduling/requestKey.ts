import type { AvailabilityPreference, SchedulingRequest } from "~/server/scheduling/types";

export function buildSchedulingRequestKey(request: SchedulingRequest): string {
  if (request.availabilityPreference === "exact_time" && request.exactTimeMinutes != null) {
    return `date:${request.requestedDate ?? "unknown"}|exact:${request.exactTimeMinutes}`;
  }
  if (request.availabilityPreference === "earliest" && !request.requestedDate) {
    return "earliest:global";
  }
  return `date:${request.requestedDate ?? "unknown"}|${request.availabilityPreference}`;
}

export function buildRangeRequestKey(rangeStart: string, rangeEnd: string): string {
  return `range:${rangeStart}|${rangeEnd}`;
}

export function offerSetKey(slots: string[]): string {
  return [...slots].sort().join("|");
}

export function requestKeyChanged(before?: string, after?: string): boolean {
  return Boolean(before && after && before !== after);
}

export function preferenceToLegacyPartOfDay(
  preference?: AvailabilityPreference,
): "morning" | "afternoon" | "evening" | "full_day" | undefined {
  switch (preference) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "full_day":
    case "earliest":
      return "full_day";
    case "exact_time":
      return undefined;
    default:
      return undefined;
  }
}
