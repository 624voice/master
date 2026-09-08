import { describe, expect, test } from "bun:test";
import { isSchedulingPreferenceOnly, parseExactDateFromMessage } from "~/server/speed2Lead/agent/slotPreferences";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

describe("slotPreferences (read-compat preference detection)", () => {
  test("parseExactDateFromMessage resolves August 31st", () => {
    const date = parseExactDateFromMessage("August 31st", "America/Chicago", new Date("2026-08-26T12:00:00.000Z"));
    expect(date).toBe("2026-08-31");
  });

  test("tomorrow preference is preference-only, not a slot selection", () => {
    const session = {
      ...createAgentSession({ tenantId: "624voice", phone: "+12149722278", firstName: "Test" }),
      stage: "offering_slots" as const,
    };
    expect(isSchedulingPreferenceOnly("tomorrow", session, new Date("2026-08-26T12:00:00.000Z"))).toBe(
      true,
    );
  });
});
