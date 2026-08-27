import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { buildContextualSlotOfferMessage } from "~/server/speed2Lead/schedulingReply";

const TZ = CONSULTATION_TIMEZONE;

describe("scheduling reply copy", () => {
  test("contextual offers avoid Which works best phrasing", () => {
    const slots = [
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 30, TZ).toISOString(),
    ];

    const messages = [
      buildContextualSlotOfferMessage({ slots, situation: "first_offer", variationSeed: "seed-a" }),
      buildContextualSlotOfferMessage({ slots, situation: "refinement", variationSeed: "seed-b" }),
      buildContextualSlotOfferMessage({ slots, situation: "after_rejection", variationSeed: "seed-c" }),
      buildContextualSlotOfferMessage({ slots, situation: "conflict", variationSeed: "seed-d" }),
    ];

    for (const message of messages) {
      expect(message.toLowerCase()).not.toContain("which works best");
      expect(message.length).toBeGreaterThan(0);
    }
  });

  test("single-slot offer states availability without reconfirmation loop", () => {
    const slot = centralDateAt(2026, 8, 26, 16, 30, TZ).toISOString();
    const message = buildContextualSlotOfferMessage({ slots: [slot], situation: "first_offer" });
    expect(message.toLowerCase()).toMatch(/open|works/);
    expect(message.toLowerCase()).not.toMatch(/grab it|should i book|want me to/);
  });
});
