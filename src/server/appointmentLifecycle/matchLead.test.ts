import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { LeadIndexEntry, NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";

const leadStore = new Map<string, LeadIndexEntry[]>();
const emailIndex = new Map<string, string>();

mock.module("~/server/appointmentLifecycle/store", () => ({
  getLeadsByPhone: async (phone: string) => leadStore.get(phone) ?? [],
  getLeadByEmail: async (email: string) => {
    const phone = emailIndex.get(email.toLowerCase());
    if (!phone) return null;
    const leads = leadStore.get(phone) ?? [];
    return leads.find((l) => l.email?.toLowerCase() === email.toLowerCase()) ?? null;
  },
}));

const { matchCalendarEventToLead } = await import("~/server/appointmentLifecycle/matchLead");

function lead(overrides: Partial<LeadIndexEntry> = {}): LeadIndexEntry {
  return {
    phone: "+15551234567",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Doe",
    businessName: "Jane HVAC",
    source: "roi",
    smsConsent: true,
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

function event(overrides: Partial<NormalizedCalendarEvent> = {}): NormalizedCalendarEvent {
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

function seedLead(entry: LeadIndexEntry) {
  const existing = leadStore.get(entry.phone) ?? [];
  leadStore.set(entry.phone, [...existing.filter((l) => l.email !== entry.email), entry]);
  if (entry.email) {
    emailIndex.set(entry.email.toLowerCase(), entry.phone);
  }
}

describe("matchLead production safety", () => {
  beforeEach(() => {
    leadStore.clear();
    emailIndex.clear();
  });

  test("phone exact match with consent-eligible lead", async () => {
    seedLead(lead());
    const result = await matchCalendarEventToLead(
      event({ attendeePhone: "+15551234567", attendeeName: "Jane Doe" }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.method).toBe("phone");
  });

  test("unique name alone produces unmatched_booking", async () => {
    seedLead(lead({ phone: "+15551111111" }));
    const result = await matchCalendarEventToLead(
      event({
        attendeeName: "Jane Doe",
        attendeePhone: undefined,
        attendeeEmail: undefined,
      }),
    );
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.reason).toBe("no_confident_match");
  });

  test("same first/last name across multiple leads cannot cause SMS without email", async () => {
    seedLead(lead({ phone: "+15551111111", email: "jane1@example.com" }));
    seedLead(
      lead({
        phone: "+15552222222",
        email: "jane2@example.com",
        firstName: "Jane",
        lastName: "Doe",
      }),
    );
    const result = await matchCalendarEventToLead(
      event({ attendeeName: "Jane Doe", attendeeEmail: undefined, attendeePhone: undefined }),
    );
    expect(result.matched).toBe(false);
  });

  test("shared office phone requires email disambiguation", async () => {
    const sharedPhone = "+15559998888";
    seedLead(lead({ phone: sharedPhone, email: "alice@example.com", firstName: "Alice" }));
    seedLead(lead({ phone: sharedPhone, email: "bob@example.com", firstName: "Bob" }));

    const noEmail = await matchCalendarEventToLead(
      event({ attendeePhone: sharedPhone, attendeeEmail: undefined }),
    );
    expect(noEmail.matched).toBe(false);
    if (!noEmail.matched) expect(noEmail.reason).toBe("ambiguous_phone_match");

    const withEmail = await matchCalendarEventToLead(
      event({ attendeePhone: sharedPhone, attendeeEmail: "bob@example.com", attendeeName: "Bob" }),
    );
    expect(withEmail.matched).toBe(true);
    if (withEmail.matched) expect(withEmail.lead.firstName).toBe("Bob");
  });

  test("email resolves duplicate phone safely", async () => {
    const sharedPhone = "+15559998888";
    seedLead(lead({ phone: sharedPhone, email: "jane@example.com" }));
    seedLead(lead({ phone: sharedPhone, email: "other@example.com", firstName: "Other" }));

    const result = await matchCalendarEventToLead(
      event({ attendeeEmail: "jane@example.com", attendeeName: "Jane Doe" }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.lead.email).toBe("jane@example.com");
  });

  test("phone match rejected when attendee name conflicts", async () => {
    seedLead(lead({ firstName: "Jane", lastName: "Doe" }));
    const result = await matchCalendarEventToLead(
      event({ attendeePhone: "+15551234567", attendeeName: "John Smith" }),
    );
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.reason).toBe("phone_name_mismatch");
  });

  test("wrong customer cannot receive another person appointment via email", async () => {
    seedLead(lead({ phone: "+15551111111", email: "jane@example.com" }));
    const result = await matchCalendarEventToLead(
      event({
        attendeeEmail: "attacker@example.com",
        attendeePhone: "+15559999999",
        attendeeName: "Attacker",
      }),
    );
    expect(result.matched).toBe(false);
  });
});
