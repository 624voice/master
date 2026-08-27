/**
 * Code-owned slot preference filtering for the rebuilt agent.
 *
 * Parses inbound scheduling constraints, re-fetches or filters real calendar
 * slots, and validates booking attempts — the LLM proposes language only.
 */
import {
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import { formatNaturalAppointmentParts } from "~/server/appointmentLifecycle/formatTime";
import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";
import {
  looksLikeSlotSelectionIntent,
  resolveOfferedSlotSelectionCandidate,
} from "~/server/speed2Lead/schedulingContext";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import {
  applyInboundSchedulingUpdate,
  parseSchedulingStateUpdate,
} from "~/server/scheduling/intentParser";
import { resolveRangeForRequest } from "~/server/scheduling/rangeResolver";
import {
  buildRequestFromCanonicalState,
  type LegacyConstraintFields,
} from "~/server/scheduling/state";
import {
  applySchedulingStateUpdate,
  clearField,
  preserve,
  replaceField,
} from "~/server/scheduling/stateUpdate";
import type { CanonicalSchedulingState } from "~/server/scheduling/types";
import { spreadAcrossDays, fetchRawConsultationSlots } from "~/server/speed2Lead/agent/scheduling";
import { slotDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";

const MAX_OFFERED_SLOTS = 6;
const SLOT_SEARCH_WINDOW_DAYS = 10;

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

export function labelOfferedSlot(iso: string, timezone: string): string {
  const parts = formatNaturalAppointmentParts(iso, timezone);
  const tz = parts.timezoneShort ? ` ${parts.timezoneShort}` : "";
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.time}${tz}`;
}

function toOfferedSlots(isos: string[], timezone: string): OfferedSlot[] {
  return isos.map((startIso) => ({ startIso, label: labelOfferedSlot(startIso, timezone) }));
}

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

function applyCanonicalToSession(
  session: AgentSession,
  canonical: CanonicalSchedulingState & LegacyConstraintFields,
): AgentSession {
  return {
    ...session,
    requestedDate: canonical.requestedDate,
    availabilityPreference: canonical.availabilityPreference,
    exactTimeMinutes: canonical.exactTimeMinutes,
    rejectedSlotStarts: canonical.rejectedSlotStarts,
    anchorTimeMinutes: canonical.anchorTimeMinutes,
    lowerTimeBound: canonical.searchAfterMinutes ?? canonical.earliestAllowedMinutes,
    upperTimeBound: canonical.searchBeforeMinutes ?? canonical.latestAllowedMinutes,
    rejectedPartOfDay: canonical.rejectedPartOfDay,
  };
}

export function parseExactDateFromMessage(
  message: string,
  timezone: string,
  now: Date,
): string | undefined {
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

/** Apply inbound preference/rejection semantics to session scheduling fields. */
export function applyInboundSlotPreferences(
  session: AgentSession,
  message: string,
  profile: AgentProfile,
  now = new Date(),
): AgentSession {
  let canonical = agentSessionToCanonical(session);
  const offeredIsos = session.offeredSlots.map((slot) => slot.startIso);

  const exactDate = parseExactDateFromMessage(message, profile.timezone, now);
  if (exactDate && exactDate !== canonical.requestedDate) {
    canonical = applySchedulingStateUpdate(canonical, {
      requestedDate: replaceField(exactDate),
      availabilityPreference: canonical.availabilityPreference
        ? preserve()
        : replaceField("full_day"),
      exactTimeMinutes: clearField(),
      anchorTimeMinutes: clearField(),
      lowerTimeBound: clearField(),
      upperTimeBound: clearField(),
      rejectedSlotStarts: { op: "clear" },
      rejectedPartOfDay: replaceField([]),
      invalidateOffers: true,
    });
  }

  canonical = applyInboundSchedulingUpdate(canonical, message, now, offeredIsos);
  return applyCanonicalToSession(session, canonical);
}

function applyRejectedFilter(isos: string[], rejected?: string[]): string[] {
  if (!rejected?.length) return isos;
  const blocked = new Set(rejected);
  return isos.filter((iso) => !blocked.has(iso));
}

export function filterPoolSlots(
  poolIsos: string[],
  canonical: CanonicalSchedulingState & LegacyConstraintFields,
  profile: AgentProfile,
): string[] {
  let candidates = poolIsos;
  if (canonical.requestedDate) {
    candidates = candidates.filter(
      (iso) => slotDateKey(iso, profile.timezone) === canonical.requestedDate,
    );
  }

  const businessHours = getConsultationBusinessHours();
  const duration = getConsultationDurationMinutes();
  const request =
    buildRequestFromCanonicalState(canonical, profile.timezone, businessHours, duration) ??
    ({
      timezone: profile.timezone,
      availabilityPreference: canonical.availabilityPreference ?? "full_day",
      requestedDate: canonical.requestedDate,
      businessHours,
      meetingDurationMinutes: duration,
    } as import("~/server/scheduling/types").SchedulingRequest);

  const filtered = filterAndRankSlots({
    rawSlots: candidates,
    request,
    maxOffer: MAX_OFFERED_SLOTS,
  });
  return applyRejectedFilter(filtered, canonical.rejectedSlotStarts);
}

async function fetchProviderSlotsForRequest(
  canonical: CanonicalSchedulingState & LegacyConstraintFields,
  profile: AgentProfile,
  now: Date,
): Promise<{ ok: true; raw: string[] } | { ok: false; reason: string }> {
  const businessHours = getConsultationBusinessHours();
  const duration = getConsultationDurationMinutes();
  const request = buildRequestFromCanonicalState(
    canonical,
    profile.timezone,
    businessHours,
    duration,
  );

  if (!request) {
    return { ok: false, reason: "no_scheduling_request" };
  }

  const resolved = resolveRangeForRequest(request, now);
  if ("error" in resolved) {
    return { ok: false, reason: resolved.error };
  }

  const result = await fetchRawConsultationSlots(profile, {
    rangeStart: resolved.rangeStart.toISOString(),
    rangeEnd: resolved.rangeEnd.toISOString(),
    maxSlots: 200,
    now,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  return { ok: true, raw: result.slots };
}

async function initialWideFetch(
  profile: AgentProfile,
  now: Date,
): Promise<{ ok: true; slots: OfferedSlot[]; pool: OfferedSlot[] } | { ok: false; reason: string }> {
  const rangeEnd = new Date(now.getTime() + SLOT_SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const result = await fetchRawConsultationSlots(profile, {
    rangeStart: now.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    maxSlots: 200,
    now,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const spread = spreadAcrossDays(result.slots, MAX_OFFERED_SLOTS);
  const pool = toOfferedSlots(result.slots, profile.timezone);
  return {
    ok: true,
    slots: toOfferedSlots(spread, profile.timezone),
    pool,
  };
}

export type ResolvedAgentSlots = {
  slots: OfferedSlot[];
  pool: OfferedSlot[];
  fetchFailed: boolean;
  session: AgentSession;
};

/** Resolve the active offered slot list for this turn after applying inbound prefs. */
export async function resolveSlotsForAgentTurn(
  session: AgentSession,
  inboundBody: string,
  profile: AgentProfile,
  now = new Date(),
): Promise<ResolvedAgentSlots> {
  if (session.stage === "bridge") {
    const fetched = await initialWideFetch(profile, now);
    if (!fetched.ok) {
      return { slots: [], pool: [], fetchFailed: true, session };
    }
    return {
      slots: fetched.slots,
      pool: fetched.pool,
      fetchFailed: false,
      session: { ...session, slotPool: fetched.pool, offeredSlots: fetched.slots },
    };
  }

  if (session.stage !== "offering_slots" && session.stage !== "confirming") {
    return { slots: [], pool: session.slotPool ?? [], fetchFailed: false, session };
  }

  const withPrefs = applyInboundSlotPreferences(session, inboundBody, profile, now);
  const canonical = agentSessionToCanonical(withPrefs);
  const poolIsos = (withPrefs.slotPool ?? withPrefs.offeredSlots).map((slot) => slot.startIso);

  const fetched = await fetchProviderSlotsForRequest(canonical, profile, now);
  if (fetched.ok) {
    const pool = toOfferedSlots(fetched.raw, profile.timezone);
    const filtered = filterPoolSlots(fetched.raw, canonical, profile);
    const slots = toOfferedSlots(filtered, profile.timezone);
    return {
      slots,
      pool,
      fetchFailed: false,
      session: { ...withPrefs, slotPool: pool, offeredSlots: slots },
    };
  }

  if (poolIsos.length > 0) {
    const filtered = filterPoolSlots(poolIsos, canonical, profile);
    const slots = toOfferedSlots(filtered, profile.timezone);
    return {
      slots,
      pool: withPrefs.slotPool ?? withPrefs.offeredSlots,
      fetchFailed: false,
      session: { ...withPrefs, offeredSlots: slots },
    };
  }

  return { slots: [], pool: [], fetchFailed: true, session: withPrefs };
}

export function isSchedulingPreferenceOnly(
  body: string,
  session: AgentSession,
  now = new Date(),
): boolean {
  const canonical = agentSessionToCanonical(session);
  const offeredIsos = session.offeredSlots.map((slot) => slot.startIso);
  if (resolveOfferedSlotSelectionCandidate(body, offeredIsos)) {
    return false;
  }

  const exactDate = parseExactDateFromMessage(body, "", now);
  const update = parseSchedulingStateUpdate(body, canonical, now, offeredIsos);
  const prefChanged =
    update.requestedDate?.op === "replace" ||
    update.availabilityPreference?.op === "replace" ||
    update.exactTimeMinutes?.op === "replace" ||
    update.rejectedSlotStarts?.op === "add" ||
    update.rejectedSlotStarts?.op === "clear" ||
    update.invalidateOffers === true ||
    Boolean(exactDate);

  return prefChanged;
}

export function validateConfirmBooking(args: {
  body: string;
  session: AgentSession;
  offered: OfferedSlot[];
  slotChoiceIndex: number | null;
  confirmBooking: boolean;
  now?: Date;
}): { proceed: boolean; slot?: OfferedSlot; logReason?: string } {
  if (!args.confirmBooking) {
    return { proceed: false };
  }

  const now = args.now ?? new Date();
  const offeredIsos = args.offered.map((slot) => slot.startIso);

  if (isSchedulingPreferenceOnly(args.body, args.session, now)) {
    return { proceed: false, logReason: "confirm_booking_on_preference_only" };
  }

  const selectedIso = resolveOfferedSlotSelectionCandidate(args.body, offeredIsos);
  if (selectedIso) {
    const slot = args.offered.find((entry) => entry.startIso === selectedIso);
    if (slot) return { proceed: true, slot };
  }

  if (
    args.slotChoiceIndex != null &&
    args.slotChoiceIndex >= 0 &&
    args.slotChoiceIndex < args.offered.length &&
    (looksLikeSlotSelectionIntent(args.body) ||
      (args.offered.length === 1 &&
        /\b(yes|yeah|yep|sure|ok(?:ay)?|book|confirm|that works|sounds good)\b/i.test(args.body)))
  ) {
    return { proceed: true, slot: args.offered[args.slotChoiceIndex] };
  }

  return { proceed: false, logReason: "confirm_booking_without_valid_slot_selection" };
}
