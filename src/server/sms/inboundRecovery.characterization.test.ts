/**
 * Workstream 3 characterization: documents current inbound/recovery ownership.
 * Does not invent product decisions. Open questions are in
 * docs/phase-c-recovery-cases.md.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  capturedOutboundSms,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { getAgentSession, createAgentSession, saveAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
);
const { handleInboundSms } = await import("~/server/speed2Lead/handleInbound");
const { shouldSkipAgentOpener } = await import("~/server/speed2Lead/agent/contactFlow/crossFlow");
const { handleIngressCompliance } = await import("~/server/sms/optOut");
const { unknownInboundMessage } = await import("~/server/speed2Lead/messages");
const { createSession, saveSession } = await import("~/server/speed2Lead/session");

const inboundRoute = readFileSync(new URL("../../routes/api/sms/inbound.ts", import.meta.url), "utf8");

describe("inbound ownership (current, not redesigned)", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("ingress routes to the rebuilt agent only when an AgentSession exists", () => {
    expect(inboundRoute).toContain("const agentSession = await getAgentSession(normalizePhone(from))");
    expect(inboundRoute).toContain("await handleAgentInboundSms(from, body, params.MessageSid)");
    expect(inboundRoute).toContain("await handleInboundSms(from, body, params.MessageSid)");
    expect(inboundRoute.indexOf("handleAgentInboundSms")).toBeLessThan(inboundRoute.indexOf("await handleInboundSms"));
  });

  test("missing AgentSession is unknown inbound on the legacy handler", async () => {
    const phone = "+15550003001";
    expect(await getAgentSession(phone)).toBeNull();
    await handleInboundSms(phone, "hey what's next");
    expect(capturedOutboundSms).toEqual([unknownInboundMessage()]);
  });

  test("legacy ROI session still gets unknownInboundMessage, not advanceConversation", async () => {
    const phone = "+15550003002";
    await saveSession(
      createSession({
        phone,
        firstName: "Test",
        businessName: "Test Co",
        email: "test@example.com",
        annualOpportunity: "$50,000",
        primaryOpportunity: "Missed calls",
        reportUrl: "https://example.com/report",
        bookingUrl: "https://example.com/book",
      }),
    );
    expect(await getAgentSession(phone)).toBeNull();
    await handleInboundSms(phone, "I want to book Thursday");
    expect(capturedOutboundSms).toEqual([unknownInboundMessage()]);
  });

  test("a live AgentSession is the rebuilt-engine ownership signal", async () => {
    const phone = "+15550003003";
    const session = createAgentSession({
      tenantId: "624voice",
      phone,
      flow: "roi",
      firstName: "Jamie",
    });
    await saveAgentSession(session);
    expect(await getAgentSession(phone)).not.toBeNull();
    expect(await shouldSkipAgentOpener(phone, "contact")).toEqual({
      skip: true,
      reason: "agent_session:roi",
    });
  });

  test("Twilio-classified STOP does not request an application confirmation SMS", async () => {
    const result = await handleIngressCompliance({
      optOutType: "STOP",
      body: "hello",
      phone: "+15550003004",
    });
    expect(result).toEqual({ handled: true, sendLegacyConfirmation: false });
    expect(capturedOutboundSms).toEqual([]);
  });

  test("application fallback STOP without an AgentSession still requests legacy confirmation", async () => {
    const result = await handleIngressCompliance({
      body: "STOP",
      phone: "+15550003005",
    });
    expect(result.handled).toBe(true);
    expect(result.sendLegacyConfirmation).toBe(true);
  });
});
