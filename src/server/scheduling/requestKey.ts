import type { AvailabilityPreference, SchedulingRequest } from "~/server/scheduling/types";

function boundSegment(value: number | undefined, prefix: string): string {
  return value != null ? `${prefix}${value}` : "";
}

export function buildSchedulingRequestKey(request: SchedulingRequest): string {
  const bounds = [
    boundSegment(request.lowerTimeBound, "lo:"),
    boundSegment(request.upperTimeBound, "hi:"),
    boundSegment(request.anchorTime, "anchor:"),
  ]
    .filter(Boolean)
    .join("|");

  if (request.availabilityPreference === "exact_time" && request.exactTimeMinutes != null) {
    const base = `date:${request.requestedDate ?? "unknown"}|exact:${request.exactTimeMinutes}`;
    return bounds ? `${base}|${bounds}` : base;
  }
  if (request.availabilityPreference === "earliest" && !request.requestedDate) {
    return bounds ? `earliest:global|${bounds}` : "earliest:global";
  }
  const base = `date:${request.requestedDate ?? "unknown"}|${request.availabilityPreference}`;
  return bounds ? `${base}|${bounds}` : base;
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
