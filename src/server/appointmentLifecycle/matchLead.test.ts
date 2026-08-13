import { describe, expect, test } from "bun:test";
import {
  extractPhoneFromText,
  matchCalendarEventToLead,
} from "~/server/appointmentLifecycle/matchLead";
import type { LeadIndexEntry, NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";
import { getRedis } from "~/server/speed2Lead/redis";
import { saveLeadIndex } from "~/server/appointmentLifecycle/store";

const hasRedis =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

function baseEvent(overrides: Partial<NormalizedCalendarEvent> = {}): NormalizedCalendarEvent {
  return {
    calendarEventId: "evt-1",
    status: "confirmed",
    appointmentStart: "2026-08-15T20:00:00.000Z",
    appointmentEnd: "2026-08-15T20:30:00.000Z",
    timezone: "America/Chicago",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function lead(overrides: Partial<LeadIndexEntry> = {}): LeadIndexEntry {
  return {
    phone: "+15551234567",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Doe",
    businessName: "Jane HVAC",
    source: "roi",
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("matchLead", () => {
  test("extractPhoneFromText finds common formats", () => {
    expect(extractPhoneFromText("Phone: (555) 123-4567")).toBe("+15551234567");
    expect(extractPhoneFromText("Mobile number: 555-987-6543")).toBe("+15559876543");
  });

  (hasRedis ? test : test.skip)("phone exact normalized match", async () => {
    await saveLeadIndex(lead());
    const result = await matchCalendarEventToLead(
      baseEvent({ attendeePhone: "(555) 123-4567" }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.method).toBe("phone");
      expect(result.lead.phone).toBe("+15551234567");
    }
  });

  (hasRedis ? test : test.skip)("email match when phone missing", async () => {
    await saveLeadIndex(lead({ phone: "+15559876543" }));
    const result = await matchCalendarEventToLead(
      baseEvent({
        attendeePhone: undefined,
        attendeeEmail: "jane@example.com",
      }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.method).toBe("email");
  });

  (hasRedis ? test : test.skip)("ambiguous name match does not send", async () => {
    await saveLeadIndex(lead({ phone: "+15551111111" }));
    await saveLeadIndex(
      lead({ phone: "+15552222222", email: "other@example.com", lastName: "Smith" }),
    );
    const result = await matchCalendarEventToLead(
      baseEvent({
        attendeeName: "Jane Doe",
        attendeeEmail: undefined,
        attendeePhone: undefined,
      }),
    );
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.reason).toBe("ambiguous_name_match");
  });

  (hasRedis ? test : test.skip)("unmatched event when no lead", async () => {
    const result = await matchCalendarEventToLead(
      baseEvent({ attendeePhone: "+15559999999", attendeeEmail: "unknown@example.com" }),
    );
    expect(result.matched).toBe(false);
  });
});

if (!hasRedis) {
  console.warn("Skipping Redis-backed matchLead tests — UPSTASH_REDIS_* not configured");
}
