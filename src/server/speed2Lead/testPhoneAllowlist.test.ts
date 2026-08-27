import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import type { ConversationContext } from "~/server/speed2Lead/types";
import {
  capturedOutboundSms,
  capturedRedisStore,
  getDemoFollowUpMembers,
  getNurtureMembers,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
  seedDemoFollowUpMember,
  seedNurtureMember,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const {
  parseSpeed2LeadTestPhones,
  resetSpeed2LeadTestPhonesCacheForTests,
  resolveDiagnosticTestPhone,
  shouldUseSpeed2LeadLlmForPhone,
  isSpeed2LeadTestPhoneAllowlistActive,
} = await import("~/server/speed2Lead/testPhoneAllowlist");
const { resetSpeed2LeadTestPhone } = await import("~/server/speed2Lead/resetTestPhone");
const {
  enqueueNurtureFollowUp,
  processNurtureFollowUps,
  registerNurtureOnSession,
  removeNurtureFollowUp,
  shouldSendNurtureFollowUp,
} = await import("~/server/speed2Lead/nurtureFollowUp");
const { saveSession } = await import("~/server/speed2Lead/session");

const handleInboundSource = readFileSync(
  new URL("./handleInbound.ts", import.meta.url),
  "utf8",
);

beforeEach(() => {
  delete process.env.SPEED2LEAD_LLM_ENABLED;
  delete process.env.SPEED2LEAD_TEST_PHONES;
  resetSpeed2LeadTestPhonesCacheForTests();
  resetSpeed2LeadIntegrationMocks();
});

afterEach(() => {
  delete process.env.SPEED2LEAD_LLM_ENABLED;
  delete process.env.SPEED2LEAD_TEST_PHONES;
  resetSpeed2LeadTestPhonesCacheForTests();
});

describe("SPEED2LEAD_TEST_PHONES allowlist", () => {
  test("parses comma and whitespace separated E.164 numbers", () => {
    expect(parseSpeed2LeadTestPhones("+15551234567, +15559876543")).toEqual([
      "+15551234567",
      "+15559876543",
    ]);
    expect(parseSpeed2LeadTestPhones("(555) 123-4567")).toEqual(["+15551234567"]);
  });

  test("allowlisted preview test phone can use LLM path when LLM enabled", () => {
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    process.env.SPEED2LEAD_TEST_PHONES = "+15551234567";
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(shouldUseSpeed2LeadLlmForPhone("+15551234567")).toBe(true);
  });

  test("non-allowlisted phone cannot use LLM when preview allowlist is active", () => {
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    process.env.SPEED2LEAD_TEST_PHONES = "+15551234567";
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(shouldUseSpeed2LeadLlmForPhone("+15559998888")).toBe(false);
  });

  test("absence of SPEED2LEAD_TEST_PHONES preserves existing LLM behavior", () => {
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(isSpeed2LeadTestPhoneAllowlistActive()).toBe(false);
    expect(shouldUseSpeed2LeadLlmForPhone("+15559998888")).toBe(true);
  });

  test("production-style config remains LLM disabled without test phones", () => {
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(shouldUseSpeed2LeadLlmForPhone("+15551234567")).toBe(false);
    expect(isSpeed2LeadTestPhoneAllowlistActive()).toBe(false);
  });

  test("resolveDiagnosticTestPhone fails clearly when allowlist is unset", () => {
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(resolveDiagnosticTestPhone()).toEqual({
      ok: false,
      reason: "test_phones_not_configured",
    });
  });

  test("resolveDiagnosticTestPhone selects first allowlisted phone with suffix only metadata", () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+15551234567,+15559876543";
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(resolveDiagnosticTestPhone()).toEqual({
      ok: true,
      phone: "+15551234567",
      phoneSuffix: "4567",
    });
  });

  test("resolveDiagnosticTestPhone honors explicit override without reading env first", () => {
    resetSpeed2LeadTestPhonesCacheForTests();
    expect(resolveDiagnosticTestPhone("(555) 987-6543")).toEqual({
      ok: true,
      phone: "+15559876543",
      phoneSuffix: "6543",
    });
  });

  test("STOP is handled before contact/demo routing", () => {
    const stopIndex = handleInboundSource.indexOf('intent === "stop"');
    const contactIndex = handleInboundSource.indexOf("isContactSession(session)");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeGreaterThan(stopIndex);
  });

  test("appointment lifecycle still bypasses contact/demo routing", () => {
    const lifecycleIndex = handleInboundSource.indexOf("handleAppointmentLifecycleInbound");
    const contactIndex = handleInboundSource.indexOf("isContactSession(session)");
    expect(lifecycleIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeGreaterThan(lifecycleIndex);
  });
});

describe("resetSpeed2LeadTestPhone", () => {
  test("clears only the requested allowlisted phone state", async () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+15551234567,+15559998888";
    resetSpeed2LeadTestPhonesCacheForTests();

    capturedRedisStore.set("speed2lead:session:+15551234567", { flow: "roi" });
    capturedRedisStore.set("speed2lead:session:+15559998888", { flow: "demo" });
    capturedRedisStore.set("speed2lead:optout:+15551234567", true);
    capturedRedisStore.set("appointment:active:phone:+15551234567", "evt-1");
    seedDemoFollowUpMember("+15551234567");
    seedNurtureMember("+15551234567");

    const result = await resetSpeed2LeadTestPhone("+15551234567");
    expect(result.phone).toBe("+15551234567");
    expect(capturedRedisStore.has("speed2lead:session:+15551234567")).toBe(false);
    expect(capturedRedisStore.has("speed2lead:optout:+15551234567")).toBe(false);
    expect(capturedRedisStore.has("appointment:active:phone:+15551234567")).toBe(false);
    expect(getDemoFollowUpMembers().includes("+15551234567")).toBe(false);
    expect(getNurtureMembers().includes("+15551234567")).toBe(false);
    expect(capturedRedisStore.has("speed2lead:session:+15559998888")).toBe(true);

    await expect(resetSpeed2LeadTestPhone("+15559997777")).rejects.toThrow(
      /not listed in SPEED2LEAD_TEST_PHONES/,
    );
  });
});

function roiNurtureSession(
  phone: string,
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    flow: "roi",
    phone,
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone,
      flow: "roi",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("nurture follow-up cron safety", () => {
  beforeEach(() => {
    delete process.env.SPEED2LEAD_TEST_PHONES;
    resetSpeed2LeadTestPhonesCacheForTests();
  });

  test("registers and sends stage 1 once when due", async () => {
    const phone = "+15551234567";
    const started = new Date("2026-08-21T10:00:00.000Z");
    const due = new Date(started.getTime() + 46 * 60 * 1000);
    const session = roiNurtureSession(phone, {
      nurtureStage: 0,
      nurtureStartedAt: started.toISOString(),
      nurtureNextAt: due.toISOString(),
    });
    await saveSession(session);
    await enqueueNurtureFollowUp(phone);

    expect(await processNurtureFollowUps(due)).toBe(1);
    expect(capturedOutboundSms.length).toBe(1);
    expect(await processNurtureFollowUps(due)).toBe(0);
  });

  test("does not send after customer reply", () => {
    const due = new Date();
    const session = roiNurtureSession("+15551234567", {
      nurtureStage: 0,
      nurtureNextAt: due.toISOString(),
      nurtureStartedAt: due.toISOString(),
      messages: [{ role: "user", content: "Hey", at: due.toISOString() }],
    });
    expect(shouldSendNurtureFollowUp(session, due)).toBe(false);
  });

  test("does not send for confirmed booking", async () => {
    const phone = "+15551234567";
    const due = new Date();
    const session = roiNurtureSession(phone, {
      nurtureStage: 0,
      nurtureNextAt: due.toISOString(),
      nurtureStartedAt: due.toISOString(),
      scheduling: { status: "confirmed", selectedStart: due.toISOString(), calendarEventId: "evt-1" },
    });
    await saveSession(session);
    await enqueueNurtureFollowUp(phone);
    expect(await processNurtureFollowUps(due)).toBe(0);
  });

  test("does not send for soft_closed disposition", () => {
    const due = new Date();
    const session = roiNurtureSession("+15551234567", {
      disposition: "soft_closed",
      nurtureStage: 0,
      nurtureNextAt: due.toISOString(),
      nurtureStartedAt: due.toISOString(),
    });
    expect(shouldSendNurtureFollowUp(session, due)).toBe(false);
  });

  test("skips send and clears index when STOP opted out", async () => {
    const phone = "+15551234567";
    const due = new Date("2026-08-21T12:00:00.000Z");
    await saveSession(
      roiNurtureSession(phone, {
        nurtureStage: 0,
        nurtureNextAt: due.toISOString(),
        nurtureStartedAt: due.toISOString(),
      }),
    );
    capturedRedisStore.set(`speed2lead:optout:${phone}`, true);
    await enqueueNurtureFollowUp(phone);

    expect(await processNurtureFollowUps(due)).toBe(0);
    expect(capturedOutboundSms.length).toBe(0);
    expect(getNurtureMembers()).toEqual([]);
  });

  test("does not enqueue or send for allowlisted test phones", async () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+15559876543";
    resetSpeed2LeadTestPhonesCacheForTests();
    const phone = "+15559876543";
    const session = registerNurtureOnSession(roiNurtureSession(phone));
    expect(session.nurtureNextAt).toBeUndefined();
    await enqueueNurtureFollowUp(phone);
    expect(getNurtureMembers()).toEqual([]);
  });

  test("demo follow-up index stays separate from nurture index", async () => {
    const phone = "+15551234567";
    await enqueueNurtureFollowUp(phone);
    seedDemoFollowUpMember(phone);
    expect(getNurtureMembers()).toEqual([phone]);
    expect(getDemoFollowUpMembers()).toEqual([phone]);
    await removeNurtureFollowUp(phone);
    expect(getNurtureMembers()).toEqual([]);
    expect(getDemoFollowUpMembers()).toEqual([phone]);
  });
});
