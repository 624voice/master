import { describe, expect, test } from "bun:test";
import { buildHarnessMockSlots } from "~/server/speed2Lead/agent/harnessMockSlots";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import {
  applyExplicitBookConfirmOutput,
  applyInboundSlotPreferences,
  filterPoolSlots,
  isSchedulingPreferenceOnly,
  parseExactDateFromMessage,
  validateConfirmBooking,
} from "~/server/speed2Lead/agent/slotPreferences";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import { slotDateKey, tomorrowDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";

function bridgeOfferingSession() {
  const reference = new Date("2026-08-26T12:00:00.000Z");
  const pool = buildHarnessMockSlots(DEFAULT_624VOICE_PROFILE, reference);
  return {
    reference,
    session: {
      ...createAgentSession({ tenantId: "624voice", phone: "+12149722278", firstName: "Test" }),
      stage: "offering_slots" as const,
      primaryPain: "missed_calls",
      slotPool: pool,
      offeredSlots: pool.slice(0, 6),
    },
  };
}

describe("slotPreferences", () => {
  test("parseExactDateFromMessage resolves August 31st", () => {
    const date = parseExactDateFromMessage("August 31st", "America/Chicago", new Date("2026-08-26T12:00:00.000Z"));
    expect(date).toBe("2026-08-31");
  });

  test("tomorrow preference is preference-only, not booking", () => {
    const { session, reference } = bridgeOfferingSession();
    expect(
      isSchedulingPreferenceOnly("tomorrow", session, reference),
    ).toBe(true);
    expect(
      validateConfirmBooking({
        body: "tomorrow",
        session,
        offered: session.offeredSlots,
        slotChoiceIndex: 0,
        confirmBooking: true,
        now: reference,
      }).proceed,
    ).toBe(false);
  });

  test("applyInboundSlotPreferences filters offered slots to tomorrow", () => {
    const { session, reference } = bridgeOfferingSession();
    const tomorrow = tomorrowDateKey(reference, DEFAULT_624VOICE_PROFILE.timezone);
    const updated = applyInboundSlotPreferences(session, "tomorrow", DEFAULT_624VOICE_PROFILE, reference);
    expect(updated.requestedDate).toBe(tomorrow);

    const poolIsos = (updated.slotPool ?? []).map((slot) => slot.startIso);
    const canonical = {
      status: "slots_offered" as const,
      requestedDate: updated.requestedDate,
      availabilityPreference: updated.availabilityPreference ?? "full_day",
      offeredSlots: updated.offeredSlots.map((slot) => slot.startIso),
    };
    const filtered = filterPoolSlots(poolIsos, canonical, DEFAULT_624VOICE_PROFILE);
    expect(filtered.length).toBeGreaterThan(0);
    for (const iso of filtered) {
      expect(slotDateKey(iso, DEFAULT_624VOICE_PROFILE.timezone)).toBe(tomorrow);
    }
  });

  test("first one works is a valid booking selection", () => {
    const { session, reference } = bridgeOfferingSession();
    const result = validateConfirmBooking({
      body: "The first one works",
      session,
      offered: session.offeredSlots,
      slotChoiceIndex: 0,
      confirmBooking: true,
      now: reference,
    });
    expect(result.proceed).toBe(true);
    expect(result.slot?.startIso).toBe(session.offeredSlots[0]?.startIso);
  });

  test("applyExplicitBookConfirmOutput forces confirm on yes book it in confirming", () => {
    const { session } = bridgeOfferingSession();
    session.stage = "confirming";
    const result = applyExplicitBookConfirmOutput("Yes book it", session, session.offeredSlots, {
      confirm_booking: false,
      slot_choice_index: null,
    });
    expect(result.confirm_booking).toBe(true);
    expect(result.slot_choice_index).toBe(0);
  });

  test("applyExplicitBookConfirmOutput ignores explicit book language outside scheduling", () => {
    const { session } = bridgeOfferingSession();
    session.stage = "discovery";
    const result = applyExplicitBookConfirmOutput("Yes book it", session, session.offeredSlots, {
      confirm_booking: false,
      slot_choice_index: null,
    });
    expect(result.confirm_booking).toBe(false);
  });
});
