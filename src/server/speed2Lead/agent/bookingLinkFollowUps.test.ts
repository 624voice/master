import { describe, expect, test, beforeEach } from "bun:test";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { DEFAULT_624VOICE_PROFILE } = await import("~/server/speed2Lead/agent/profile");
const { createAgentSession, saveAgentSession, enqueueNoResponseCampaign, listPendingNoResponsePhones, listPendingBookingLinkFollowUpPhones } =
  await import("~/server/speed2Lead/agent/state");
const {
  computeFollowUpTimes,
  enterBookingLinkPending,
  nextValidBookingLinkFollowUp,
  scheduleBookingLinkFollowUps,
} = await import("~/server/speed2Lead/agent/bookingLinkFollowUps");
const { runAgentFollowUpCron } = await import("~/routes/api/cron/agent-no-response-followups");

describe("booking-link follow-up campaign", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("enterBookingLinkPending cancels no-response so a phone is in at most one campaign index", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15550001111", flow: "roi" });
    session.bookingLinkSentAt = "2026-01-01T12:00:00.000Z";
    await enqueueNoResponseCampaign(session.phone);
    session = await enterBookingLinkPending(session);
    await saveAgentSession(session);
    expect(await listPendingNoResponsePhones()).not.toContain(session.phone);
    expect(await listPendingBookingLinkFollowUpPhones()).toContain(session.phone);
  });

  test("RESUME-style nextValid skips passed offsets and does not replay them", () => {
    const sentAt = "2026-01-01T12:00:00.000Z";
    const now = new Date("2026-01-02T00:00:00.000Z");
    const next = nextValidBookingLinkFollowUp({
      bookingLinkSentAt: sentAt,
      startStage: 0,
      profile: DEFAULT_624VOICE_PROFILE,
      now,
    });
    expect(next?.stage).toBe(1);
    expect(next?.nextAt).toBe(computeFollowUpTimes(sentAt, [240, 1440, 4320])[1]);
  });

  test("scheduled route runner sends a due booking-link follow-up", async () => {
    let session = createAgentSession({ tenantId: "t", phone: "+15550002222", flow: "roi", firstName: "Jamie" });
    session.stage = "booking_link_pending";
    session.bookingLinkSentAt = "2026-01-01T12:00:00.000Z";
    session = await scheduleBookingLinkFollowUps(session, DEFAULT_624VOICE_PROFILE);
    session.bookingLinkFollowUpNextAt = "2000-01-01T00:00:00.000Z";
    await saveAgentSession(session);

    const result = await runAgentFollowUpCron();
    expect(result.bookingLinkSent).toBe(1);
    expect(capturedOutboundSms[0]).toContain("did you get a chance to grab a time");
  });
});
