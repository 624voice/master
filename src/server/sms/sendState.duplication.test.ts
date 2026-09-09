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
const { startDemoAgentConversation } = await import(
  "~/server/speed2Lead/agent/demoFlow/startConversation"
);
const { startDemoSpeed2Lead } = await import("~/server/demoSpeed2Lead/startConversation");
const { createAgentSession, saveAgentSession, getAgentSession, clearAgentSession } = await import(
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

const roiInput = {
  phone: "+15550001001",
  firstName: "Jamie",
  lastName: "Lee",
  businessName: "Acme HVAC",
  email: "jamie@example.com",
  annualOpportunity: "$120,000",
  primaryOpportunity: "missed calls",
  reportUrl: "https://example.com/report",
};

const contactInputFor = (phone: string) => ({
  phone,
  firstName: "Pat",
  lastName: "Nguyen",
  businessName: "Pat Plumbing",
  email: "pat@example.com",
  message: "Need help with missed calls",
  trade: "plumbing",
  fleetSize: "4",
  websiteOption: "has" as const,
  website: "https://pat.example.com",
});

const demoAgentInputFor = (phone: string, vapiCallId: string) => ({
  phone,
  firstName: "Riley",
  lastName: "Chen",
  businessName: "Riley Electric",
  email: "riley@example.com",
  vapiCallId,
  callDurationSeconds: 90,
  callOutcome: "full" as const,
  demoSummary: null,
  websiteStatus: "has" as const,
});

const legacyDemoInputFor = (phone: string, vapiCallId: string) => ({
  phone,
  firstName: "Sam",
  lastName: "Ortiz",
  businessName: "Sam Air",
  email: "sam@example.com",
  hasWebsite: true,
  smsConsent: true,
  demoCompletedAt: new Date().toISOString(),
  durationSeconds: 45,
  vapiCallId,
});

async function markAgentSessionBooked(phone: string): Promise<void> {
  const session = await getAgentSession(phone);
  expect(session).toBeTruthy();
  await saveAgentSession({ ...session!, stage: "booked" });
}

describe("duplication-boundary replay of real upstream triggers", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    enableSpeed2LeadEnv();
  });

  test("ROI opener: two triggers before the episode exists send one SMS", async () => {
    await Promise.all([startAgentConversation(roiInput), startAgentConversation(roiInput)]);
    expect(capturedOutboundSms).toHaveLength(1);

    await startAgentConversation(roiInput);
    expect(capturedOutboundSms).toHaveLength(1);

    const session = await getAgentSession(roiInput.phone);
    expect(session?.messages.some((m) => m.role === "assistant")).toBe(true);
  });

  test("contact opener: two triggers before the episode exists send one SMS", async () => {
    const input = contactInputFor("+15550001002");
    await Promise.all([
      startContactAgentConversation(input),
      startContactAgentConversation(input),
    ]);
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("same episode replay after session drop still sends one ROI opener", async () => {
    await startAgentConversation(roiInput);
    expect(capturedOutboundSms).toHaveLength(1);

    await clearAgentSession(roiInput.phone);
    await startAgentConversation(roiInput);
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("ROI then Contact for the same phone are different episodes and each send once", async () => {
    const phone = "+15550001011";
    await startAgentConversation({ ...roiInput, phone, email: "jamie-cross@example.com" });
    expect(capturedOutboundSms).toHaveLength(1);

    await markAgentSessionBooked(phone);

    const contact = contactInputFor(phone);
    await startContactAgentConversation(contact);
    expect(capturedOutboundSms).toHaveLength(2);

    await startContactAgentConversation(contact);
    expect(capturedOutboundSms).toHaveLength(2);
  });

  test("a later Contact episode after a booked Contact episode sends once", async () => {
    const contact = contactInputFor("+15550001012");
    await startContactAgentConversation(contact);
    expect(capturedOutboundSms).toHaveLength(1);

    await markAgentSessionBooked(contact.phone);
    await startContactAgentConversation(contact);
    expect(capturedOutboundSms).toHaveLength(2);

    await startContactAgentConversation(contact);
    expect(capturedOutboundSms).toHaveLength(2);
  });

  test("demo v2: same vapiCallId concurrent and replayed sends one opener", async () => {
    const input = demoAgentInputFor("+15550001013", "call-same-episode");
    await Promise.all([startDemoAgentConversation(input), startDemoAgentConversation(input)]);
    expect(capturedOutboundSms).toHaveLength(1);

    await startDemoAgentConversation(input);
    expect(capturedOutboundSms).toHaveLength(1);

    await clearAgentSession(input.phone);
    await startDemoAgentConversation(input);
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("demo v2: a different vapiCallId after a booked demo is a new episode", async () => {
    const phone = "+15550001014";
    await startDemoAgentConversation(demoAgentInputFor(phone, "call-episode-a"));
    expect(capturedOutboundSms).toHaveLength(1);

    await markAgentSessionBooked(phone);
    await startDemoAgentConversation(demoAgentInputFor(phone, "call-episode-b"));
    expect(capturedOutboundSms).toHaveLength(2);
  });

  test("legacy demo: same Vapi call replayed at the trigger boundary sends one opener", async () => {
    const first = legacyDemoInputFor("+15550001015", "legacy-call-1");
    const replay = { ...first, demoCompletedAt: new Date().toISOString() };

    await Promise.all([startDemoSpeed2Lead(first), startDemoSpeed2Lead(replay)]);
    expect(capturedOutboundSms).toHaveLength(1);

    await startDemoSpeed2Lead({ ...first, demoCompletedAt: new Date().toISOString() });
    expect(capturedOutboundSms).toHaveLength(1);
  });

  test("legacy demo: a different Vapi call for the same phone is a new episode", async () => {
    const phone = "+15550001016";
    await startDemoSpeed2Lead(legacyDemoInputFor(phone, "legacy-call-a"));
    expect(capturedOutboundSms).toHaveLength(1);

    await startDemoSpeed2Lead(legacyDemoInputFor(phone, "legacy-call-b"));
    expect(capturedOutboundSms).toHaveLength(2);

    await startDemoSpeed2Lead(legacyDemoInputFor(phone, "legacy-call-b"));
    expect(capturedOutboundSms).toHaveLength(2);
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
