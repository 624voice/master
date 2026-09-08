import { describe, expect, test, beforeEach } from "bun:test";
import type { LeadIndexEntry, NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { saveLeadIndex, saveLifecycleRecord, getActiveLifecycleForPhone, getLeadsByPhone } = await import(
  "~/server/appointmentLifecycle/store"
);
const { resolveBookingIdentity, attributeBooking } = await import(
  "~/server/appointmentLifecycle/bookingIdentity"
);
const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");
const { createAgentSession, saveAgentSession, getAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
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
    registeredAt: "2026-01-01T00:00:00.000Z",
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
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
    attendeePhone: "+15551234567",
    attendeeEmail: "jane@example.com",
    ...overrides,
  };
}

describe("lead email index key", () => {
  test("two emails do not collide on the email index", async () => {
    const { getLeadByEmail } = await import("~/server/appointmentLifecycle/store");
    await saveLeadIndex(lead({ phone: "+15551110001", email: "jane@example.com" }));
    await saveLeadIndex(
      lead({
        phone: "+15551110002",
        email: "bob@example.com",
        firstName: "Bob",
        source: "contact",
        registeredAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    expect((await getLeadByEmail("jane@example.com"))?.phone).toBe("+15551110001");
    expect((await getLeadByEmail("bob@example.com"))?.phone).toBe("+15551110002");
  });
});

describe("§9 identity vs attribution", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("three-flow multi-touch: identity confident, attribution multi_touch, no HUMAN_FOLLOW_UP, sources unchanged", async () => {
    await saveLeadIndex(lead({ source: "roi", registeredAt: "2026-01-01T00:00:00.000Z", bookingLinkSentAt: "2026-08-10T12:00:00.000Z" }));
    await saveLeadIndex(lead({ source: "contact", registeredAt: "2026-01-02T00:00:00.000Z", bookingLinkSentAt: "2026-08-10T12:00:00.000Z" }));
    await saveLeadIndex(lead({ source: "demo", registeredAt: "2026-01-03T00:00:00.000Z", bookingLinkSentAt: "2026-08-10T12:00:00.000Z" }));

    const session = createAgentSession({ tenantId: "t", phone: "+15551234567", flow: "contact" });
    session.stage = "booking_link_pending";
    await saveAgentSession(session);

    const identity = await resolveBookingIdentity(event());
    expect(identity.status).toBe("confirmed");
    if (identity.status !== "confirmed") return;
    const attribution = attributeBooking(identity.candidates, event());
    expect(attribution.bookingAttributionSource).toBe("multi_touch");
    expect(attribution.bookingAttributionConfidence).toBe("ambiguous");

    const result = await processCalendarEvent(event({ calendarEventId: "evt-multi" }));
    expect(result.action).toBe("created");
    const after = await getAgentSession("+15551234567");
    expect(after?.stage).toBe("booked");
    expect(after?.stage).not.toBe("handoff");

    const leads = await getLeadsByPhone("+15551234567");
    expect(leads.map((l) => l.source).sort()).toEqual(["contact", "demo", "roi"]);
  });

  test("email and phone point to two different people → identity_match_ambiguous → HUMAN_FOLLOW_UP", async () => {
    await saveLeadIndex(lead({ phone: "+15551111111", email: "jane@example.com", source: "roi" }));
    await saveLeadIndex(
      lead({
        phone: "+15552222222",
        email: "bob@example.com",
        firstName: "Bob",
        source: "contact",
        registeredAt: "2026-01-02T00:00:00.000Z",
      }),
    );

    const jane = createAgentSession({ tenantId: "t", phone: "+15551111111", flow: "roi" });
    jane.stage = "booking_link_pending";
    await saveAgentSession(jane);
    const bob = createAgentSession({ tenantId: "t", phone: "+15552222222", flow: "contact" });
    bob.stage = "booking_link_pending";
    await saveAgentSession(bob);

    const identity = await resolveBookingIdentity(
      event({ attendeeEmail: "jane@example.com", attendeePhone: "+15552222222" }),
    );
    expect(identity.status).toBe("ambiguous");

    await processCalendarEvent(
      event({
        calendarEventId: "evt-conflict",
        attendeeEmail: "jane@example.com",
        attendeePhone: "+15552222222",
      }),
    );
    expect((await getAgentSession("+15551111111"))?.stage).toBe("handoff");
    expect((await getAgentSession("+15552222222"))?.stage).toBe("handoff");
    expect((await getAgentSession("+15551111111"))?.humanFollowUpReason).toBe("identity_match_ambiguous");
  });

  test("same person with active lifecycle is not excluded from identity match", async () => {
    await saveLeadIndex(lead({ bookingLinkSentAt: "2026-08-01T00:00:00.000Z" }));
    await saveLifecycleRecord({
      calendarEventId: "evt-old",
      phone: "+15551234567",
      email: "jane@example.com",
      firstName: "Jane",
      source: "roi",
      appointmentStart: "2026-08-14T20:00:00.000Z",
      appointmentEnd: "2026-08-14T20:30:00.000Z",
      timezone: "America/Chicago",
      eventStatus: "confirmed",
      lifecycleStatus: "confirmed",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    const identity = await resolveBookingIdentity(event({ calendarEventId: "evt-new" }));
    expect(identity.status).toBe("confirmed");

    const result = await processCalendarEvent(event({ calendarEventId: "evt-new" }));
    expect(["created", "rescheduled"]).toContain(result.action);
    const active = await getActiveLifecycleForPhone("+15551234567");
    expect(active?.calendarEventId).toBe("evt-new");
  });

  test("correlation fallback with exactly one historical source is confident", () => {
    const attribution = attributeBooking(
      [lead({ bookingLinkSentAt: undefined, source: "demo" })],
      event(),
    );
    expect(attribution.bookingAttributionSource).toBe("demo");
    expect(attribution.bookingAttributionConfidence).toBe("confident");
  });

  test("correlation fallback with multiple historical sources is multi_touch, not a guess", () => {
    const attribution = attributeBooking(
      [
        lead({ source: "roi", registeredAt: "2026-01-01T00:00:00.000Z" }),
        lead({ source: "demo", registeredAt: "2026-01-02T00:00:00.000Z" }),
      ],
      event(),
    );
    expect(attribution.bookingAttributionSource).toBe("multi_touch");
    expect(attribution.bookingAttributionConfidence).toBe("ambiguous");
  });
});
