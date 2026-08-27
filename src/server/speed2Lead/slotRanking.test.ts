import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { rankSlotsForOffer } from "~/server/speed2Lead/slotRanking";

const TZ = CONSULTATION_TIMEZONE;

function slotsAt(hours: number[], day = 26): string[] {
  return hours.map((hour) => centralDateAt(2026, 8, day, hour, 0, TZ).toISOString());
}

describe("rankSlotsForOffer", () => {
  test("spreads broad afternoon availability instead of adjacent 15-minute slots", () => {
    const all = [
      centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];

    const ranked = rankSlotsForOffer(all, { maxOffer: 3, minSeparationMinutes: 45 });
    expect(ranked).toHaveLength(3);
    expect(ranked[0]).toBe(centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString());
    expect(ranked[1]).toBe(centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString());
    expect(new Date(ranked[2]!).getTime()).toBeGreaterThan(
      new Date(centralDateAt(2026, 8, 26, 14, 0, TZ)).getTime(),
    );
  });

  test("returns adjacent slots when only adjacent options exist", () => {
    const adjacent = [
      centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 30, TZ).toISOString(),
    ];
    expect(rankSlotsForOffer(adjacent)).toEqual(adjacent);
  });

  test("need something later filters to materially later options", () => {
    const all = [
      centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];
    const ranked = rankSlotsForOffer(all, {
      searchAfterMinutes: 12 * 60 + 30,
      maxOffer: 3,
      minSeparationMinutes: 45,
    });
    expect(ranked.every((slot) => slot.includes("T19:") || slot.includes("T20:") || slot.includes("T21:"))).toBe(true);
  });

  test("around 3 clusters near anchor", () => {
    const all = [
      centralDateAt(2026, 8, 26, 14, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 45, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];
    const ranked = rankSlotsForOffer(all, {
      anchorMinutes: 15 * 60,
      narrowAroundAnchor: true,
      maxOffer: 3,
    });
    expect(ranked[0]).toBe(centralDateAt(2026, 8, 26, 15, 0, TZ).toISOString());
  });
});
