/**
 * Read-only scheduling-preference detection.
 *
 * Used by discovery-guard so a persisted pre-Phase-B session (or a preference
 * reply like "tomorrow") is not mistaken for a discovery answer. Nothing here
 * offers, books, or writes conversational slots.
 */
import type { AgentSession } from "~/server/speed2Lead/agent/state";
import { resolveOfferedSlotSelectionCandidate } from "~/server/speed2Lead/agent/schedulingContext";
import { parseSchedulingStateUpdate } from "~/server/speed2Lead/agent/scheduling/intentParser";
import type { LegacyConstraintFields } from "~/server/speed2Lead/agent/scheduling/state";
import type { CanonicalSchedulingState } from "~/server/speed2Lead/agent/scheduling/types";

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

function agentSessionToCanonical(session: AgentSession): CanonicalSchedulingState & LegacyConstraintFields {
  return {
    status:
      session.stage === "offering_slots" || session.stage === "confirming" ? "slots_offered" : "idle",
    requestedDate: session.requestedDate,
    availabilityPreference: session.availabilityPreference,
    exactTimeMinutes: session.exactTimeMinutes,
    offeredSlots: session.offeredSlots.map((slot) => slot.startIso),
    rejectedSlotStarts: session.rejectedSlotStarts,
    anchorTimeMinutes: session.anchorTimeMinutes,
    searchAfterMinutes: session.lowerTimeBound,
    searchBeforeMinutes: session.upperTimeBound,
    rejectedPartOfDay: session.rejectedPartOfDay,
    partOfDay:
      session.availabilityPreference === "morning"
        ? "morning"
        : session.availabilityPreference === "afternoon"
          ? "afternoon"
          : session.availabilityPreference === "evening"
            ? "evening"
            : session.availabilityPreference === "full_day" ||
                session.availabilityPreference === "earliest"
              ? "full_day"
              : undefined,
  };
}

export function parseExactDateFromMessage(
  message: string,
  timezone: string,
  now: Date,
): string | undefined {
  void timezone;
  const match = message
    .toLowerCase()
    .match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
    );
  if (!match) return undefined;

  const month = MONTH_NAMES.indexOf(match[1] as (typeof MONTH_NAMES)[number]) + 1;
  const day = Number.parseInt(match[2] ?? "0", 10);
  if (month <= 0 || day <= 0) return undefined;

  const year = now.getFullYear();
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const candidateMs = new Date(`${candidate}T12:00:00`).getTime();
  if (candidateMs < now.getTime() - 24 * 60 * 60 * 1000) {
    return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return candidate;
}

/** True when inbound is a date/daypart preference, not a slot selection or meeting yes. */
export function isSchedulingPreferenceOnly(
  body: string,
  session: AgentSession,
  now = new Date(),
): boolean {
  const offeredIsos = session.offeredSlots.map((slot) => slot.startIso);
  if (resolveOfferedSlotSelectionCandidate(body, offeredIsos)) {
    return false;
  }

  const exactDate = parseExactDateFromMessage(body, "", now);
  if (exactDate) return true;

  // Parse against a neutral baseline so repeat prefs ("Tomorrow" again) still count.
  const baseline = agentSessionToCanonical({
    ...session,
    requestedDate: undefined,
    availabilityPreference: undefined,
    exactTimeMinutes: undefined,
    anchorTimeMinutes: undefined,
    lowerTimeBound: undefined,
    upperTimeBound: undefined,
    rejectedSlotStarts: [],
    rejectedPartOfDay: undefined,
  });
  const update = parseSchedulingStateUpdate(body, baseline, now, offeredIsos);
  return (
    update.requestedDate?.op === "replace" ||
    update.availabilityPreference?.op === "replace" ||
    update.exactTimeMinutes?.op === "replace" ||
    update.rejectedSlotStarts?.op === "add" ||
    update.rejectedSlotStarts?.op === "clear" ||
    update.invalidateOffers === true
  );
}
