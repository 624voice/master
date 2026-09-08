import { describe, expect, test, beforeEach } from "bun:test";
import { mock } from "bun:test";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

mock.module("~/server/speed2Lead/agent/llmTurn", () => ({
  runAgentTurn: async () => ({
    reply: "Got it — happy to keep going when you're ready.",
    stage: "discovery",
    primary_pain: null,
    wants_meeting: false,
    opt_out: false,
    discovery_answer_sufficient: false,
  }),
  enforceReplyHygiene: (text: string) => text.trim(),
}));

const { createAgentSession, getAgentSession, saveAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
);
const { handleAgentInboundSms } = await import("~/server/speed2Lead/agent/handleInbound");
const { SPEED2LEAD_BOOKING_URL } = await import("~/config/features");

function persistLegacySession(stage: "offering_slots" | "confirming", phone: string) {
  const session = createAgentSession({
    tenantId: "624voice",
    phone,
    flow: "roi",
    firstName: "Legacy",
  });
  session.stage = stage;
  session.offeredSlots = [{ startIso: "2026-09-10T15:00:00.000Z", label: "Thursday 10:00am CT" }];
  session.requestedDate = "2026-09-10";
  session.discoveryClosed = true;
  return saveAgentSession(session);
}

describe("persisted pre-Phase-B scheduling stages (read-compat)", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("offering_slots + meeting intent enters booking-link, not conversational book", async () => {
    await persistLegacySession("offering_slots", "+15550001001");
    await handleAgentInboundSms("+15550001001", "can we schedule a time", "SM-legacy-offer");

    const persisted = await getAgentSession("+15550001001");
    expect(persisted?.stage).toBe("booking_link_pending");
    expect(persisted?.bookingLinkSentAt).toBeTruthy();
    expect(capturedOutboundSms.some((body) => body.includes(SPEED2LEAD_BOOKING_URL))).toBe(true);
    expect(capturedOutboundSms.join("\n")).not.toMatch(/10:00am|Thursday 10/);
    expect(persisted?.bookedEventId).toBeUndefined();
    expect(persisted?.stage).not.toBe("offering_slots");
    expect(persisted?.stage).not.toBe("confirming");
    expect(persisted?.stage).not.toBe("booked");
  });

  test("confirming + meeting intent enters booking-link, not conversational book", async () => {
    await persistLegacySession("confirming", "+15550001002");
    await handleAgentInboundSms("+15550001002", "can we schedule a time", "SM-legacy-confirm");

    const persisted = await getAgentSession("+15550001002");
    expect(persisted?.stage).toBe("booking_link_pending");
    expect(capturedOutboundSms.some((body) => body.includes(SPEED2LEAD_BOOKING_URL))).toBe(true);
    expect(persisted?.bookedEventId).toBeUndefined();
    expect(persisted?.stage).not.toBe("confirming");
  });

  test("offering_slots + non-intent inbound remaps to bridge and is not stuck", async () => {
    await persistLegacySession("offering_slots", "+15550001003");
    await handleAgentInboundSms("+15550001003", "thanks", "SM-legacy-thanks");

    const persisted = await getAgentSession("+15550001003");
    expect(persisted).toBeTruthy();
    expect(persisted?.stage).toBe("bridge");
    expect(persisted?.stage).not.toBe("offering_slots");
    expect(persisted?.stage).not.toBe("confirming");
    expect(persisted?.bookedEventId).toBeUndefined();
    expect(capturedOutboundSms.join("\n")).not.toMatch(/I've booked you|You're all set/);
  });
});
