/**
 * Deterministic calendar slots for harness runs when Google OAuth is unavailable locally.
 * Shape matches real `offerSlots()` output so date/daypart checks behave realistically.
 */
import { formatNaturalAppointmentParts } from "~/server/appointmentLifecycle/formatTime";
import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import { addCalendarDaysInTimezone, dateKeyInTimezone, slotWeekday } from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import type { OfferedSlot } from "~/server/speed2Lead/agent/state";
import type { SlotFetchResult } from "~/server/speed2Lead/agent/scheduling";
import { spreadAcrossDays } from "~/server/speed2Lead/agent/scheduling";

function labelForSlot(iso: string, timezone: string): string {
  const parts = formatNaturalAppointmentParts(iso, timezone);
  const tz = parts.timezoneShort ? ` ${parts.timezoneShort}` : "";
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.time}${tz}`;
}

/** Build slot ISO strings at local wall-clock hours (CDT/CST offset handled via -05:00/-06:00 simplification). */
function localSlotIso(dateKey: string, hourLocal: number): string {
  const offset = "-05:00";
  return `${dateKey}T${String(hourLocal).padStart(2, "0")}:00:00${offset}`;
}

/** Full mock pool (all day/hour combos) — used for code-owned preference filtering. */
export function buildHarnessMockPoolIsos(reference = new Date(), timezone: string): string[] {
  const candidates: string[] = [];
  for (let dayOffset = 1; dayOffset <= 10; dayOffset += 1) {
    const day = addCalendarDaysInTimezone(reference, timezone, dayOffset);
    const dateKey = dateKeyInTimezone(day, timezone);
    for (const hour of [9, 10, 11, 14, 15, 16, 17]) {
      candidates.push(localSlotIso(dateKey, hour));
    }
  }
  return candidates;
}

export function buildHarnessMockSlotIsos(reference = new Date(), timezone: string): string[] {
  return spreadAcrossDays(buildHarnessMockPoolIsos(reference, timezone), 12);
}

export function buildHarnessMockSlots(profile: AgentProfile, reference = new Date()): OfferedSlot[] {
  return buildHarnessMockSlotIsos(reference, profile.timezone).map((startIso) => ({
    startIso,
    label: labelForSlot(startIso, profile.timezone),
  }));
}

export async function harnessMockOfferSlots(profile: AgentProfile): Promise<SlotFetchResult> {
  return { ok: true, slots: buildHarnessMockSlots(profile) };
}

export async function harnessMockRawSlots(profile: AgentProfile): Promise<import("~/server/speed2Lead/agent/scheduling").RawSlotFetchResult> {
  return { ok: true, slots: buildHarnessMockPoolIsos(new Date(), profile.timezone) };
}

/** Mock pool with all Monday slots removed — for partially-booked calendar tests. */
export function buildHarnessMockPoolMondayBlocked(reference = new Date(), timezone: string): string[] {
  return buildHarnessMockPoolIsos(reference, timezone).filter(
    (iso) => slotWeekday(iso, timezone) !== "Monday",
  );
}

export function buildHarnessMockSlotsMondayBlocked(
  profile: AgentProfile,
  reference = new Date(),
): OfferedSlot[] {
  return spreadAcrossDays(buildHarnessMockPoolMondayBlocked(reference, profile.timezone), 12).map(
    (startIso) => ({
      startIso,
      label: labelForSlot(startIso, profile.timezone),
    }),
  );
}

export async function harnessMockRawSlotsMondayBlocked(
  profile: AgentProfile,
): Promise<import("~/server/speed2Lead/agent/scheduling").RawSlotFetchResult> {
  return { ok: true, slots: buildHarnessMockPoolMondayBlocked(new Date(), profile.timezone) };
}
