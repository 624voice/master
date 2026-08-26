import { describe, expect, test } from "bun:test";
import { spreadAcrossDays } from "~/server/speed2Lead/agent/scheduling";

function iso(day: number, hour: number): string {
  return new Date(Date.UTC(2026, 7, day, hour)).toISOString();
}

describe("spreadAcrossDays", () => {
  test("prefers one slot per day over consecutive same-day times", () => {
    const candidates = [
      iso(1, 9),
      iso(1, 10),
      iso(1, 11),
      iso(2, 9),
      iso(3, 9),
    ];

    const picked = spreadAcrossDays(candidates, 3);

    expect(picked).toEqual([iso(1, 9), iso(2, 9), iso(3, 9)]);
  });

  test("fills in a second round once every day has been used once", () => {
    const candidates = [iso(1, 9), iso(1, 10), iso(2, 9)];

    const picked = spreadAcrossDays(candidates, 3);

    expect(picked).toEqual([iso(1, 9), iso(2, 9), iso(1, 10)]);
  });

  test("never returns more than max even with abundant candidates", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => iso(1 + Math.floor(i / 5), 9 + (i % 5)));
    const picked = spreadAcrossDays(candidates, 6);
    expect(picked.length).toBe(6);
  });

  test("returns everything when fewer candidates than max", () => {
    const candidates = [iso(1, 9), iso(2, 9)];
    expect(spreadAcrossDays(candidates, 6)).toEqual(candidates);
  });
});
