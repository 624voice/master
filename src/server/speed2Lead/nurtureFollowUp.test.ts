import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { ConversationContext } from "~/server/speed2Lead/types";

const redisSets = new Map<string, Set<string>>();
const smsLog: string[] = [];

mock.module("~/server/speed2Lead/redis", () => ({
  getRedis: () => ({
    sadd: async (key: string, member: string) => {
      if (!redisSets.has(key)) redisSets.set(key, new Set());
      redisSets.get(key)!.add(member);
    },
    srem: async (key: string, member: string) => {
      redisSets.get(key)?.delete(member);
    },
    smembers: async (key: string) => [...(redisSets.get(key) ?? [])],
  }),
}));

mock.module("~/server/speed2Lead/session", () => ({
  getSession: async (phone: string) => sessions.get(phone) ?? null,
  saveSession: async (session: ConversationContext) => {
    sessions.set(session.phone, session);
  },
  isOptedOut: async () => false,
}));

mock.module("~/server/speed2Lead/conversationSms", () => ({
  sendConversationSms: async (_phone: string, message: string) => {
    smsLog.push(message);
    return null;
  },
}));

const sessions = new Map<string, ConversationContext>();

const {
  enqueueNurtureFollowUp,
  processNurtureFollowUps,
  registerNurtureOnSession,
  removeNurtureFollowUp,
  shouldSendNurtureFollowUp,
} = await import("~/server/speed2Lead/nurtureFollowUp");
const { resetSpeed2LeadTestPhonesCacheForTests } = await import(
  "~/server/speed2Lead/testPhoneAllowlist"
);

function roiSession(phone: string, overrides: Partial<ConversationContext> = {}): ConversationContext {
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

beforeEach(() => {
  redisSets.clear();
  smsLog.length = 0;
  sessions.clear();
  delete process.env.SPEED2LEAD_TEST_PHONES;
  resetSpeed2LeadTestPhonesCacheForTests();
});

describe("nurture follow-up safety", () => {
  test("registers and sends stage 1 once when due", async () => {
    const phone = "+15551234567";
    const started = new Date("2026-08-21T10:00:00.000Z");
    const due = new Date(started.getTime() + 46 * 60 * 1000);
    const session = registerNurtureOnSession(
      roiSession(phone, {
        nurtureStage: 0,
        nurtureStartedAt: started.toISOString(),
        nurtureNextAt: due.toISOString(),
      }),
    );
    sessions.set(phone, session);
    await enqueueNurtureFollowUp(phone);

    expect(await processNurtureFollowUps(due)).toBe(1);
    expect(smsLog.length).toBe(1);
    expect(await processNurtureFollowUps(due)).toBe(0);
  });

  test("does not send after customer reply", async () => {
    const phone = "+15551234567";
    const due = new Date();
    const session = roiSession(phone, {
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
    const session = roiSession(phone, {
      nurtureStage: 0,
      nurtureNextAt: due.toISOString(),
      nurtureStartedAt: due.toISOString(),
      scheduling: { status: "confirmed", selectedStart: due.toISOString(), calendarEventId: "evt-1" },
    });
    sessions.set(phone, session);
    await enqueueNurtureFollowUp(phone);
    expect(await processNurtureFollowUps(due)).toBe(0);
  });

  test("does not enqueue or send for allowlisted test phones", async () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+12148438991";
    resetSpeed2LeadTestPhonesCacheForTests();
    const phone = "+12148438991";
    const session = registerNurtureOnSession(roiSession(phone));
    expect(session.nurtureNextAt).toBeUndefined();
    await enqueueNurtureFollowUp(phone);
    expect([...(redisSets.get("speed2lead:nurture-followups") ?? [])]).toEqual([]);
  });

  test("reset removes phone from nurture index", async () => {
    const phone = "+15551234567";
    await enqueueNurtureFollowUp(phone);
    await removeNurtureFollowUp(phone);
    expect([...(redisSets.get("speed2lead:nurture-followups") ?? [])]).toEqual([]);
  });
});
