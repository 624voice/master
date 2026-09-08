import { describe, expect, test, beforeEach } from "bun:test";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { createAgentSession, saveAgentSession, listPendingBookingLinkFollowUpPhones } = await import(
  "~/server/speed2Lead/agent/state"
);
const { enterHumanFollowUp } = await import("~/server/speed2Lead/agent/humanFollowUp");
const { resolveHumanFollowUp } = await import("~/server/speed2Lead/agent/humanFollowUpResolve");
const { DEFAULT_624VOICE_PROFILE } = await import("~/server/speed2Lead/agent/profile");
const { computeFollowUpTimes } = await import("~/server/speed2Lead/agent/bookingLinkFollowUps");
const { saveLifecycleRecord } = await import("~/server/appointmentLifecycle/store");

describe("human follow-up", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("enterHumanFollowUp is an atomic handoff setter and pauses automation", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15558880000", flow: "roi" });
    session.stage = "booking_link_pending";
    session.bookingLinkFollowUpStage = 1;
    session = await enterHumanFollowUp(session, "explicit_human_request");
    expect(session.stage).toBe("handoff");
    expect(session.humanFollowUpReason).toBe("explicit_human_request");
    expect(session.humanFollowUpPriorStage).toBe("booking_link_pending");
    expect(session.humanFollowUpPriorFollowUpStage).toBe(1);
  });

  test("RESUME from booking_link_pending re-enqueues a live follow-up and does not replay a passed offset", async () => {
    const sentAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    let session = createAgentSession({ tenantId: "t", phone: "+15558881111", flow: "roi" });
    session.stage = "handoff";
    session.humanFollowUpPriorStage = "booking_link_pending";
    session.humanFollowUpPriorFollowUpStage = 0;
    session.humanFollowUpReason = "explicit_human_request";
    session.bookingLinkSentAt = sentAt;
    await saveAgentSession(session);

    const result = await resolveHumanFollowUp({ phone: session.phone, action: "RESUME" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.stage).toBe("booking_link_pending");
    expect(result.session.bookingLinkFollowUpStage).toBe(1);
    const expected = computeFollowUpTimes(sentAt, DEFAULT_624VOICE_PROFILE.bookingFollowUpOffsetsMinutes)[1];
    expect(result.session.bookingLinkFollowUpNextAt).toBe(expected);
    expect(await listPendingBookingLinkFollowUpPhones()).toContain(session.phone);
  });

  test("RESUME from discovery does not reconstruct nurture", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15558882222", flow: "contact" });
    session.stage = "handoff";
    session.humanFollowUpPriorStage = "discovery";
    session.humanFollowUpReason = "explicit_human_request";
    await saveAgentSession(session);

    const result = await resolveHumanFollowUp({ phone: session.phone, action: "RESUME" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.stage).toBe("discovery");
    expect(result.session.noResponseNextAt).toBeUndefined();
    expect(await listPendingBookingLinkFollowUpPhones()).not.toContain(session.phone);
  });

  test("CLOSE is terminal declined", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15558883333", flow: "demo" });
    session.stage = "handoff";
    session.humanFollowUpPriorStage = "bridge";
    session.humanFollowUpReason = "explicit_human_request";
    await saveAgentSession(session);
    const result = await resolveHumanFollowUp({ phone: session.phone, action: "CLOSE" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.stage).toBe("declined");
  });

  test("BOOKED without a real lifecycle is refused", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15558884444", flow: "roi" });
    session.stage = "handoff";
    session.humanFollowUpReason = "explicit_human_request";
    await saveAgentSession(session);
    const result = await resolveHumanFollowUp({ phone: session.phone, action: "BOOKED" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refused).toBe("BOOKED");
  });

  test("BOOKED with a real lifecycle reconciles via enterBooked", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15558885555", flow: "roi" });
    session.stage = "handoff";
    session.humanFollowUpReason = "explicit_human_request";
    await saveAgentSession(session);
    await saveLifecycleRecord({
      calendarEventId: "evt-real",
      phone: "+15558885555",
      firstName: "Jamie",
      source: "roi",
      appointmentStart: "2026-08-15T20:00:00.000Z",
      appointmentEnd: "2026-08-15T20:30:00.000Z",
      timezone: "America/Chicago",
      eventStatus: "confirmed",
      lifecycleStatus: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = await resolveHumanFollowUp({ phone: session.phone, action: "BOOKED" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.stage).toBe("booked");
    expect(result.session.bookedEventId).toBe("evt-real");
  });
});
