import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { buildHarnessMockSlots } from "~/server/speed2Lead/agent/harnessMockSlots";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import { buildContactSchedulingTurnReply } from "~/server/speed2Lead/agent/contactFlow/schedulingReply";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import { tomorrowDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import { applyInboundSlotPreferences } from "~/server/speed2Lead/agent/slotPreferences";

describe("buildContactSchedulingTurnReply", () => {
  const reference = new Date("2026-08-26T12:00:00.000Z");
  const pool = buildHarnessMockSlots(DEFAULT_624VOICE_PROFILE, reference);

  test("offers filtered slots for tomorrow preference at bridge", () => {
    let session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "bridge" as const,
      discoveryClosed: true,
      slotPool: pool,
      offeredSlots: pool.slice(0, 6),
    };
    session = applyInboundSlotPreferences(session, "Tomorrow", DEFAULT_624VOICE_PROFILE, reference);

    const reply = buildContactSchedulingTurnReply({
      session,
      inboundBody: "Tomorrow",
      offered: session.offeredSlots,
      fetchFailed: false,
      profile: DEFAULT_624VOICE_PROFILE,
      now: reference,
    });

    expect(reply).toMatch(/are open\.|is open\./);
    expect(session.requestedDate).toBe(
      tomorrowDateKey(reference, DEFAULT_624VOICE_PROFILE.timezone),
    );
  });

  test("does not override non-scheduling replies when calendar fetch failed", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "offering_slots" as const,
      discoveryClosed: true,
      requestedDate: tomorrowDateKey(reference, DEFAULT_624VOICE_PROFILE.timezone),
    };

    const reply = buildContactSchedulingTurnReply({
      session,
      inboundBody: "How does pricing work?",
      offered: [],
      fetchFailed: true,
      profile: DEFAULT_624VOICE_PROFILE,
      now: reference,
    });

    expect(reply).toBeNull();
  });
});
