import { describe, expect, test, beforeEach } from "bun:test";
import type { LeadIndexEntry } from "~/server/appointmentLifecycle/types";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import {
  CALENDAR_OWNER_EMAIL,
  FALSE_PHONE_FROM_EMAIL_LOCAL_PART,
  PRODUCTION_APPOINTMENT_SCHEDULE_EVENT,
  PRODUCTION_GUEST_EMAIL,
  PRODUCTION_GUEST_NAME,
  PRODUCTION_GUEST_PHONE,
} from "~/server/appointmentLifecycle/testSupport/fixtures/event_2prb1u0_appointment_schedule";

installSpeed2LeadIntegrationMocks();

const { parseGoogleCalendarApiEvent } = await import("~/server/appointmentLifecycle/parseCalendarEvent");
const { resolveBookingIdentity, attributeBooking } = await import(
  "~/server/appointmentLifecycle/bookingIdentity"
);
const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");
const { saveLeadIndex, getLifecycleRecord } = await import("~/server/appointmentLifecycle/store");
const {
  createAgentSession,
  saveAgentSession,
  getAgentSession,
  enqueueBookingLinkFollowUp,
  listPendingBookingLinkFollowUpPhones,
} = await import("~/server/speed2Lead/agent/state");

const GUEST_PHONE = PRODUCTION_GUEST_PHONE;

function matchingLead(overrides: Partial<LeadIndexEntry> = {}): LeadIndexEntry {
  return {
    phone: GUEST_PHONE,
    email: PRODUCTION_GUEST_EMAIL,
    firstName: "PhaseA",
    lastName: "ProdSmoke",
    businessName: "PhaseA Prod Smoke",
    source: "roi",
    smsConsent: true,
    registeredAt: "2026-09-08T21:00:00.000Z",
    bookingLinkSentAt: "2026-09-08T21:30:00.000Z",
    ...overrides,
  };
}

describe("production Appointment Schedule identity lifecycle", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("raw Google event → parse → resolveBookingIdentity matches the guest lead", async () => {
    await saveLeadIndex(matchingLead());

    const parsed = parseGoogleCalendarApiEvent(PRODUCTION_APPOINTMENT_SCHEDULE_EVENT);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.attendeeEmail).toBe(PRODUCTION_GUEST_EMAIL);
    expect(parsed.attendeeEmail).not.toBe(CALENDAR_OWNER_EMAIL);
    expect(parsed.attendeePhone).toBe(PRODUCTION_GUEST_PHONE);
    expect(parsed.attendeePhone).not.toBe(FALSE_PHONE_FROM_EMAIL_LOCAL_PART);
    expect(parsed.attendeeName).toBe(PRODUCTION_GUEST_NAME);

    const identity = await resolveBookingIdentity(parsed);
    expect(identity.status).toBe("confirmed");
    if (identity.status !== "confirmed") return;
    expect(identity.candidates).toHaveLength(1);
    expect(identity.candidates[0]?.phone).toBe(GUEST_PHONE);
    expect(identity.candidates[0]?.email).toBe(PRODUCTION_GUEST_EMAIL);
    expect(identity.candidates[0]?.source).toBe("roi");

    const attribution = attributeBooking(identity.candidates, parsed);
    expect(attribution.bookingAttributionSource).toBe("roi");
    expect(attribution.bookingAttributionConfidence).toBe("confident");
  });

  test("identity match → confirmed lifecycle → AgentSession booked → booking-link campaign cancelled", async () => {
    const lead = matchingLead();
    await saveLeadIndex(lead);

    const session = createAgentSession({
      tenantId: "t",
      phone: GUEST_PHONE,
      flow: "roi",
      firstName: "PhaseA",
      email: PRODUCTION_GUEST_EMAIL,
    });
    session.stage = "booking_link_pending";
    session.bookingLinkSentAt = lead.bookingLinkSentAt;
    session.bookingLinkFollowUpResolved = false;
    session.bookingLinkFollowUpStage = 0;
    session.bookingLinkFollowUpNextAt = "2026-09-08T21:34:00.000Z";
    await saveAgentSession(session);
    await enqueueBookingLinkFollowUp(GUEST_PHONE);
    expect(await listPendingBookingLinkFollowUpPhones()).toContain(GUEST_PHONE);

    const parsed = parseGoogleCalendarApiEvent(PRODUCTION_APPOINTMENT_SCHEDULE_EVENT);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const identity = await resolveBookingIdentity(parsed);
    expect(identity.status).not.toBe("unmatched");
    expect(identity.status).toBe("confirmed");

    const result = await processCalendarEvent(parsed);
    expect(result.action).not.toBe("unmatched");
    expect(result.action).toBe("created");
    expect(result.smsSent).toBe(true);

    const lifecycle = await getLifecycleRecord(parsed.calendarEventId);
    expect(lifecycle?.lifecycleStatus).toBe("confirmed");
    expect(lifecycle?.lifecycleStatus).not.toBe("unmatched_booking");
    expect(lifecycle?.phone).toBe(GUEST_PHONE);
    expect(lifecycle?.email).toBe(PRODUCTION_GUEST_EMAIL);
    expect(lifecycle?.source).toBe("roi");
    expect(lifecycle?.bookingAttributionSource).toBe("roi");

    const after = await getAgentSession(GUEST_PHONE);
    expect(after?.stage).toBe("booked");
    expect(after?.flow).toBe("roi");
    expect(after?.bookingLinkFollowUpResolved).toBe(true);
    expect(after?.bookingLinkFollowUpNextAt).toBeUndefined();
    expect(await listPendingBookingLinkFollowUpPhones()).not.toContain(GUEST_PHONE);
  });
});
