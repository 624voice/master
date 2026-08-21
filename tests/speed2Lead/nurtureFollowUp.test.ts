import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { ConversationContext } from "~/server/speed2Lead/types";

const redisStore = new Map<string, unknown>();
const nurtureMembers = new Set<string>();
const smsLog: string[] = [];

mock.module("~/server/speed2Lead/redis", () => ({
  getRedis: () => ({
    get: async (key: string) => redisStore.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      redisStore.set(key, value);
    },
    del: async (key: string) => {
      redisStore.delete(key);
    },
    sadd: async (key: string, member: string) => {
      if (key === "speed2lead:nurture-followups") {
        nurtureMembers.add(member);
      }
    },
    srem: async (key: string, member: string) => {
      if (key === "speed2lead:nurture-followups") {
        nurtureMembers.delete(member);
      }
    },
    smembers: async (key: string) => {
      if (key === "speed2lead:nurture-followups") {
        return [...nurtureMembers];
      }
      return [];
    },
  }),
}));

mock.module("~/server/speed2Lead/conversationSms", () => ({
  sendConversationSms: async (_phone: string, message: string) => {
    smsLog.push(message);
    return null;
  },
}));

const {
  enqueueNurtureFollowUp,
  processNurtureFollowUps,
  registerNurtureOnSession,
  removeNurtureFollowUp,
  shouldSendNurtureFollowUp,
} = await import("~/server/speed2Lead/nurtureFollowUp");
const { saveSession } = await import("~/server/speed2Lead/session");
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

async function seedSession(session: ConversationContext): Promise<void> {
  await saveSession(session);
}

beforeEach(() => {
  redisStore.clear();
  nurtureMembers.clear();
  smsLog.length = 0;
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
    await seedSession(session);
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
    await seedSession(session);
    await enqueueNurtureFollowUp(phone);
    expect(await processNurtureFollowUps(due)).toBe(0);
  });

  test("does not send for soft_closed disposition", () => {
    const due = new Date();
    const session = roiSession("+15551234567", {
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
    await seedSession(
      roiSession(phone, {
        nurtureStage: 0,
        nurtureNextAt: due.toISOString(),
        nurtureStartedAt: due.toISOString(),
      }),
    );
    redisStore.set(`speed2lead:optout:${phone}`, true);
    await enqueueNurtureFollowUp(phone);

    expect(await processNurtureFollowUps(due)).toBe(0);
    expect(smsLog.length).toBe(0);
    expect([...nurtureMembers]).toEqual([]);
  });

  test("does not enqueue or send for allowlisted test phones", async () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+12148438991";
    resetSpeed2LeadTestPhonesCacheForTests();
    const phone = "+12148438991";
    const session = registerNurtureOnSession(roiSession(phone));
    expect(session.nurtureNextAt).toBeUndefined();
    await enqueueNurtureFollowUp(phone);
    expect([...nurtureMembers]).toEqual([]);
  });

  test("reset removes phone from nurture index", async () => {
    const phone = "+15551234567";
    await enqueueNurtureFollowUp(phone);
    await removeNurtureFollowUp(phone);
    expect([...nurtureMembers]).toEqual([]);
  });
});
