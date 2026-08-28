import { describe, expect, test } from "bun:test";
import { buildHarnessMockPoolMondayBlocked } from "~/server/speed2Lead/agent/harnessMockSlots";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import {
  filterPoolSlots,
  resolveSlotsForAgentTurn,
} from "~/server/speed2Lead/agent/slotPreferences";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import {
  nextWeekdayDateKey,
  slotWeekday,
} from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import { setHarnessOfferSlotsOverride } from "~/server/speed2Lead/agent/scheduling";
import {
  buildHarnessMockSlotsMondayBlocked,
  harnessMockRawSlotsMondayBlocked,
} from "~/server/speed2Lead/agent/harnessMockSlots";

describe("slotPreferences calendar fixtures", () => {
  const reference = new Date("2026-08-26T12:00:00.000Z");
  const timezone = DEFAULT_624VOICE_PROFILE.timezone;
  const mondayKey = nextWeekdayDateKey("Monday", reference, timezone);
  const tuesdayKey = nextWeekdayDateKey("Tuesday", reference, timezone);

  test("monday-blocked fixture still has Tuesday slots in pool", () => {
    const pool = buildHarnessMockPoolMondayBlocked(reference, timezone);
    expect(pool.some((iso) => slotWeekday(iso, timezone) === "Monday")).toBe(false);
    expect(pool.some((iso) => slotWeekday(iso, timezone) === "Tuesday")).toBe(true);

    const mondayFiltered = filterPoolSlots(pool, {
      status: "slots_offered",
      requestedDate: mondayKey,
      availabilityPreference: "full_day",
      offeredSlots: [],
    }, DEFAULT_624VOICE_PROFILE);
    expect(mondayFiltered.length).toBe(0);

    const tuesdayFiltered = filterPoolSlots(pool, {
      status: "slots_offered",
      requestedDate: tuesdayKey,
      availabilityPreference: "full_day",
      offeredSlots: [],
    }, DEFAULT_624VOICE_PROFILE);
    expect(tuesdayFiltered.length).toBeGreaterThan(0);
  });

  test("resolveSlotsForAgentTurn offers Tuesday after Monday blocked", async () => {
    setHarnessOfferSlotsOverride(
      () => Promise.resolve({ ok: true, slots: buildHarnessMockSlotsMondayBlocked(DEFAULT_624VOICE_PROFILE, reference) }),
      () => harnessMockRawSlotsMondayBlocked(DEFAULT_624VOICE_PROFILE),
    );

    let session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "offering_slots" as const,
      requestedDate: mondayKey,
      availabilityPreference: "full_day" as const,
      offeredSlots: [],
      slotPool: [],
    };

    const mondayResult = await resolveSlotsForAgentTurn(
      session,
      "Monday",
      DEFAULT_624VOICE_PROFILE,
      reference,
    );
    expect(mondayResult.slots.length).toBe(0);

    session = { ...mondayResult.session, stage: "offering_slots" };
    const tuesdayResult = await resolveSlotsForAgentTurn(
      session,
      "Tuesday",
      DEFAULT_624VOICE_PROFILE,
      reference,
    );

    expect(tuesdayResult.fetchFailed).toBe(false);
    expect(tuesdayResult.session.requestedDate).toBe(tuesdayKey);
    expect(tuesdayResult.slots.length).toBeGreaterThan(0);

    setHarnessOfferSlotsOverride(null);
  });
});
