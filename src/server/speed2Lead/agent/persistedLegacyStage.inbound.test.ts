import { describe, expect, test, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { createAgentSession, getAgentSession, saveAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
);
const { persistSessionAfterTurn } = await import("~/server/speed2Lead/agent/handleInbound");
const { executeBookingLinkTransition, shouldTransitionToBookingLink } = await import(
  "~/server/speed2Lead/agent/bookingLinkHandoff"
);
const { SPEED2LEAD_BOOKING_URL } = await import("~/config/features");

function legacySession(stage: "offering_slots" | "confirming", phone: string) {
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
  return session;
}

describe("persisted pre-Phase-B scheduling stages (read-compat)", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("inbound meeting-intent branch still owns offering_slots / confirming", () => {
    const inbound = readFileSync(new URL("./handleInbound.ts", import.meta.url), "utf8");
    const transitionIdx = inbound.indexOf("if (shouldTransitionToBookingLink(session, body))");
    const executeIdx = inbound.indexOf("await executeBookingLinkTransition(session, messageSid)");
    const llmIdx = inbound.indexOf("output = await runAgentTurn(profile, session)");
    expect(transitionIdx).toBeGreaterThan(-1);
    expect(executeIdx).toBeGreaterThan(-1);
    expect(llmIdx).toBeGreaterThan(executeIdx);
    expect(transitionIdx).toBeLessThan(llmIdx);
    expect(inbound).toContain("persistSessionAfterTurn");
    expect(inbound).toMatch(/next\.stage === "offering_slots" \|\| next\.stage === "confirming"/);
  });

  test("offering_slots + meeting intent enters booking-link, not conversational book", async () => {
    const session = legacySession("offering_slots", "+15550001001");
    await saveAgentSession(session);
    expect(shouldTransitionToBookingLink(session, "can we schedule a time")).toBe(true);

    const returned = await executeBookingLinkTransition(session);
    const persisted = await getAgentSession(session.phone);

    expect(returned.stage).toBe("booking_link_pending");
    expect(persisted?.stage).toBe("booking_link_pending");
    expect(persisted?.bookingLinkSentAt).toBeTruthy();
    expect(capturedOutboundSms.some((body) => body.includes(SPEED2LEAD_BOOKING_URL))).toBe(true);
    expect(capturedOutboundSms.join("\n")).not.toMatch(/10:00am|Thursday 10/);
    expect(persisted?.bookedEventId).toBeUndefined();
  });

  test("confirming + meeting intent enters booking-link, not conversational book", async () => {
    const session = legacySession("confirming", "+15550001002");
    await saveAgentSession(session);
    expect(shouldTransitionToBookingLink(session, "can we schedule a time")).toBe(true);

    const returned = await executeBookingLinkTransition(session);
    expect(returned.stage).toBe("booking_link_pending");
    expect((await getAgentSession(session.phone))?.stage).toBe("booking_link_pending");
    expect(capturedOutboundSms.some((body) => body.includes(SPEED2LEAD_BOOKING_URL))).toBe(true);
    expect(returned.bookedEventId).toBeUndefined();
  });

  test("offering_slots + non-intent persist remaps to bridge and is not stuck", async () => {
    const session = legacySession("offering_slots", "+15550001003");
    await saveAgentSession(session);
    expect(shouldTransitionToBookingLink(session, "thanks")).toBe(false);

    await persistSessionAfterTurn(session);
    const persisted = await getAgentSession(session.phone);
    expect(persisted?.stage).toBe("bridge");
    expect(persisted?.bookedEventId).toBeUndefined();
  });

  test("confirming + non-intent persist remaps to bridge and is not stuck", async () => {
    const session = legacySession("confirming", "+15550001004");
    await saveAgentSession(session);
    expect(shouldTransitionToBookingLink(session, "thanks")).toBe(false);

    await persistSessionAfterTurn(session);
    const persisted = await getAgentSession(session.phone);
    expect(persisted?.stage).toBe("bridge");
    expect(persisted?.stage).not.toBe("confirming");
  });
});
