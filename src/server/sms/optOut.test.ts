import { describe, expect, test, mock, beforeEach } from "bun:test";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

mock.module("~/server/speed2Lead/conversationSms", () => ({
  sendConversationSms: async () => {},
}));
mock.module("~/server/demoSpeed2Lead/processFollowUps", () => ({
  removeDemoFollowUp: async () => {},
}));
mock.module("~/server/speed2Lead/nurtureFollowUp", () => ({
  removeNurtureFollowUp: async () => {},
}));

const { handleIngressCompliance, STANDARD_START_KEYWORDS, STANDARD_STOP_KEYWORDS } = await import(
  "~/server/sms/optOut"
);
const { setOptedOut, isOptedOut, clearOptedOut } = await import("~/server/speed2Lead/session");
const { createAgentSession, saveAgentSession } = await import("~/server/speed2Lead/agent/state");

describe("ingress compliance", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("Twilio STOP/START/HELP are handled distinctly with no app confirmation flag", async () => {
    const stop = await handleIngressCompliance({ optOutType: "STOP", body: "hello", phone: "+15551111111" });
    expect(stop).toEqual({ handled: true, sendLegacyConfirmation: false });
    expect(await isOptedOut("+15551111111")).toBe(true);

    await clearOptedOut("+15552222222");
    const start = await handleIngressCompliance({ optOutType: "START", body: "hello", phone: "+15552222222" });
    expect(start).toEqual({ handled: true, sendLegacyConfirmation: false });

    const help = await handleIngressCompliance({ optOutType: "HELP", body: "help", phone: "+15553333333" });
    expect(help).toEqual({ handled: true, sendLegacyConfirmation: false });
  });

  test("fallback STOP with an agent session is silent", async () => {
    const session = createAgentSession({ tenantId: "624voice", phone: "+15554444444", flow: "roi" });
    await saveAgentSession(session);
    const result = await handleIngressCompliance({ body: "STOP", phone: "+15554444444" });
    expect(result.sendLegacyConfirmation).toBe(false);
    expect(await isOptedOut("+15554444444")).toBe(true);
  });

  test("fallback STOP without an agent session requests legacy confirmation", async () => {
    const result = await handleIngressCompliance({ body: "cancel", phone: "+15555555555" });
    expect(result.handled).toBe(true);
    expect(result.sendLegacyConfirmation).toBe(true);
  });

  test("normal yes from an opted-in prospect is not intercepted", async () => {
    const result = await handleIngressCompliance({ body: "yes", phone: "+15556666666" });
    expect(result.handled).toBe(false);
  });

  test("fallback START only evaluates when locally opted out", async () => {
    const open = await handleIngressCompliance({ body: "start", phone: "+15557777777" });
    expect(open.handled).toBe(false);

    await setOptedOut("+15557777777");
    const reopt = await handleIngressCompliance({ body: "start", phone: "+15557777777" });
    expect(reopt.handled).toBe(true);
    expect(await isOptedOut("+15557777777")).toBe(false);
  });

  test("START keywords never include yes", () => {
    expect(STANDARD_START_KEYWORDS.has("yes")).toBe(false);
    expect(STANDARD_START_KEYWORDS.has("start")).toBe(true);
    expect(STANDARD_STOP_KEYWORDS.has("cancel")).toBe(true);
  });
});
