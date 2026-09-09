import { describe, expect, test, beforeEach } from "bun:test";
import type { LeadIndexEntry, NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { saveLeadIndex } = await import("~/server/appointmentLifecycle/store");
const { extractEmailFromText, extractPhoneFromText, matchCalendarEventToLead } = await import(
  "~/server/appointmentLifecycle/matchLead"
);

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

async function seedLead(entry: LeadIndexEntry): Promise<void> {
  await saveLeadIndex(entry);
}

describe("matchLead production safety", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("phone exact match with consent-eligible lead", async () => {
    await seedLead(lead());
    const result = await matchCalendarEventToLead(
      event({ attendeePhone: "+15551234567", attendeeName: "Jane Doe" }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.method).toBe("phone");
  });

  test("unique name alone produces unmatched_booking", async () => {
    await seedLead(lead({ phone: "+15551111111" }));
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
    await seedLead(lead({ phone: "+15551111111", email: "jane1@example.com" }));
    await seedLead(
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
    await seedLead(lead({ phone: sharedPhone, email: "alice@example.com", firstName: "Alice" }));
    await seedLead(lead({ phone: sharedPhone, email: "bob@example.com", firstName: "Bob" }));

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
    await seedLead(lead({ phone: sharedPhone, email: "jane@example.com" }));
    await seedLead(lead({ phone: sharedPhone, email: "other@example.com", firstName: "Other" }));

    const result = await matchCalendarEventToLead(
      event({ attendeeEmail: "jane@example.com", attendeeName: "Jane Doe" }),
    );
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.lead.email).toBe("jane@example.com");
  });

  test("phone match rejected when attendee name conflicts", async () => {
    await seedLead(lead({ firstName: "Jane", lastName: "Doe" }));
    const result = await matchCalendarEventToLead(
      event({ attendeePhone: "+15551234567", attendeeName: "John Smith" }),
    );
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.reason).toBe("phone_name_mismatch");
  });

  test("wrong customer cannot receive another person appointment via email", async () => {
    await seedLead(lead({ phone: "+15551111111", email: "jane@example.com" }));
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

describe("extractPhoneFromText", () => {
  test("numeric-local-part emails cannot produce a phone", () => {
    expect(extractPhoneFromText("s2l.phasea.prod.1788905100222@example.com")).toBeUndefined();
    expect(extractPhoneFromText("Contact: 1788905100222@example.com")).toBeUndefined();
  });

  test("URLs containing long digit runs cannot produce a phone", () => {
    expect(extractPhoneFromText("See https://example.com/path/15551234567890/status")).toBeUndefined();
    expect(extractPhoneFromText("https://maps.example.com/place/2149722278123")).toBeUndefined();
  });

  test("tel: URI is extracted even when a numeric-local-part email is present", () => {
    expect(
      extractPhoneFromText(
        "Guest: 1788905100222@example.com\nCall tel:+12145551212 if needed",
      ),
    ).toBe("+12145551212");
  });

  test("labeled phone is extracted even when a numeric-local-part email is present", () => {
    expect(
      extractPhoneFromText(
        "Email: 1788905100222@example.com\nMobile: (214) 555-1212",
      ),
    ).toBe("+12145551212");
  });

  test("ordinary formatted phone values still parse", () => {
    expect(extractPhoneFromText("Phone number: (555) 123-4567")).toBe("+15551234567");
    expect(extractPhoneFromText("Reach me at 555-123-4567")).toBe("+15551234567");
    expect(extractPhoneFromText("+1 (555) 123-4567")).toBe("+15551234567");
    expect(extractPhoneFromText("2149722278")).toBe("+12149722278");
  });

  test("digits inside a longer numeric sequence are not a phone", () => {
    expect(extractPhoneFromText("Reference 1788905100222")).toBeUndefined();
  });

  test("alphanumeric identifiers are not phones", () => {
    expect(extractPhoneFromText("order15551234567xyz")).toBeUndefined();
  });
});

describe("extractEmailFromText", () => {
  test("extracts a plain email", () => {
    expect(extractEmailFromText("Email: jane@example.com")).toBe("jane@example.com");
  });
});
