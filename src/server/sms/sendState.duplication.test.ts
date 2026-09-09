import { beforeEach, describe, expect, test } from "bun:test";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { startAgentConversation } = await import("~/server/speed2Lead/agent/startConversation");
const { startContactAgentConversation } = await import(
  "~/server/speed2Lead/agent/contactFlow/startConversation"
);
const { createAgentSession, saveAgentSession, getAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
);
const { handleAgentInboundSms } = await import("~/server/speed2Lead/agent/handleInbound");
const { processPendingBookingLinkFollowUps, scheduleBookingLinkFollowUps } = await import(
  "~/server/speed2Lead/agent/bookingLinkFollowUps"
);
const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");
const { saveLeadIndex } = await import("~/server/appointmentLifecycle/store");
const { DEFAULT_624VOICE_PROFILE } = await import("~/server/speed2Lead/agent/profile");
const { sendHumanAlert } = await import("~/server/speed2Lead/agent/humanAlert");

function enableSpeed2LeadEnv(): void {
  process.env.SPEED2LEAD_ENABLED = "true";
  process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "ACtest";
  process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "test-token";
  process.env.TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "+15551212000";
  process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "https://example.com";
  process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "test";
}

describe("duplication-boundary replay of real upstream triggers", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    enableSpeed2LeadEnv();
  });

  test("ROI opener: two triggers before the episode exists send one SMS", async () => {
    const input = {
      phone: "+15550001001",
      firstName: "Jamie",
      lastName: "Lee",
      businessName: "Acme HVAC",
      email: "jamie@example.com",
      annualOpportunity: "$120,000",
      primaryOpportunity: "missed calls",
      reportUrl: "https://example.com/report",
    };

    await Promise.all([startAgentConversation(input), startAgentConversation(input)]);
    expect(capturedOutboundSms).toHaveLength(1);

    await startAgentConversation(input);
    expect(capturedOutboundSms).toHaveLength(1);

    const session = await getAgentSession(input.phone);
    expect(session?.messages.some((m) => m.role === "assistant")).toBe(true);
  });

  test("contact opener: two triggers before the episode exists send one SMS", async () => {
    const input = {
      phone: "+15550001002",
      firstName: "Pat",
      lastName: "Nguyen",
      businessName: "Pat Plumbing",
      email: "pat@example.com",
      message: "Need help with missed calls",
      trade: "plumbing",
      fleetSize: "4",
      websiteOption: "has" as const,
      website: "https://pat.example.com",
    };

    await Promise.all([
      startContactAgentConversation(input),
      startContactAgentConversation(input),
    ]);
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("inbound reply: the same Twilio MessageSid delivered twice sends one reply", async () => {
    const phone = "+15550001003";
    let session = createAgentSession({
      tenantId: "624voice",
      phone,
      flow: "roi",
      firstName: "Jamie",
      businessName: "Acme HVAC",
    });
    session.stage = "discovery";
    await saveAgentSession(session);

    await Promise.all([
      handleAgentInboundSms(phone, "tell me more about the report", "SM-dup-inbound-1"),
      handleAgentInboundSms(phone, "tell me more about the report", "SM-dup-inbound-1"),
    ]);

    const outbound = capturedOutboundSms.filter((body) => !body.startsWith("S2L "));
    expect(outbound).toHaveLength(1);
  });

  test("booking-link follow-up: two workers on the same due touch send one SMS", async () => {
    let session = createAgentSession({
      tenantId: "624voice",
      phone: "+15550001004",
      flow: "roi",
      firstName: "Jamie",
    });
    session.stage = "booking_link_pending";
    session.bookingLinkSentAt = "2026-01-01T12:00:00.000Z";
    session = await scheduleBookingLinkFollowUps(session, DEFAULT_624VOICE_PROFILE);
    session.bookingLinkFollowUpNextAt = "2000-01-01T00:00:00.000Z";
    await saveAgentSession(session);

    const now = new Date("2026-01-02T00:00:00.000Z");
    const [a, b] = await Promise.all([
      processPendingBookingLinkFollowUps(now),
      processPendingBookingLinkFollowUps(now),
    ]);
    expect(a + b).toBe(1);
    expect(capturedOutboundSms).toHaveLength(1);

    const again = await getAgentSession(session.phone);
    expect(again).toBeTruthy();
    const rewound = {
      ...again!,
      bookingLinkFollowUpStage: 0,
      bookingLinkFollowUpNextAt: "2000-01-01T00:00:00.000Z",
      bookingLinkFollowUpResolved: false,
    };
    await saveAgentSession(rewound);
    await processPendingBookingLinkFollowUps(now);
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("calendar confirmation: same eligible Google event processed twice sends one SMS", async () => {
    const phone = "+15550001005";
    await saveLeadIndex({
      phone,
      email: "jamie@example.com",
      firstName: "Jamie",
      businessName: "Acme HVAC",
      source: "roi",
      smsConsent: true,
      registeredAt: "2026-01-01T00:00:00.000Z",
    });

    const event = {
      calendarEventId: "evt-dup-confirm-1",
      status: "confirmed" as const,
      summary: "624Voice AI Consultation - Jamie",
      attendeeEmail: "jamie@example.com",
      attendeePhone: phone,
      appointmentStart: "2026-09-20T15:00:00-05:00",
      appointmentEnd: "2026-09-20T15:30:00-05:00",
      timezone: "America/Chicago",
      meetingLink: "https://meet.google.com/dup-test",
      updatedAt: "2026-09-09T00:00:00.000Z",
      createdAt: "2026-09-09T00:00:00.000Z",
    };

    await Promise.all([processCalendarEvent(event), processCalendarEvent(event)]);
    const confirmations = capturedOutboundSms.filter((body) =>
      /confirmed|calendar|meet\.google|consultation/i.test(body),
    );
    expect(confirmations.length).toBe(1);
  });

  test("internal alert: the same logical event is claimed once", async () => {
    const [a, b] = await Promise.all([
      sendHumanAlert({
        reason: "explicit_human_request",
        subjectId: "+15550001006",
        body: "S2L explicit human request from +15550001006 (roi).",
      }),
      sendHumanAlert({
        reason: "explicit_human_request",
        subjectId: "+15550001006",
        body: "S2L explicit human request from +15550001006 (roi).",
      }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});
