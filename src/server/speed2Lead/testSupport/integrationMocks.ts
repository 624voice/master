import { beforeEach, mock } from "bun:test";

/** Shared outbound SMS capture for integration tests — one mock, many consumers. */
export const capturedOutboundSms: string[] = [];

export type FakeSendSms = (to: string, body: string) => Promise<{ sid: string }>;

const defaultFakeSendSms: FakeSendSms = async (_to, body) => {
  capturedOutboundSms.push(body);
  return { sid: `SM-mock-${capturedOutboundSms.length}` };
};

let fakeSendSms: FakeSendSms = defaultFakeSendSms;

/** Controlled provider fake for deterministic crash/timeout tests. Test-only. */
export function setFakeSendSms(fn: FakeSendSms | null): void {
  fakeSendSms = fn ?? defaultFakeSendSms;
}

/** Shared in-memory Redis backing store for integration tests. */
export const capturedRedisStore = new Map<string, unknown>();

export const NURTURE_INDEX_KEY = "speed2lead:nurture-followups";
export const DEMO_FOLLOWUP_INDEX_KEY = "speed2lead:demo-followups";

let installed = false;

function redisSet(key: string): Set<string> {
  const existing = capturedRedisStore.get(key) as Set<string> | undefined;
  if (existing) {
    return existing;
  }
  const created = new Set<string>();
  capturedRedisStore.set(key, created);
  return created;
}

export function getNurtureMembers(): string[] {
  return [...redisSet(NURTURE_INDEX_KEY)];
}

export function getDemoFollowUpMembers(): string[] {
  return [...redisSet(DEMO_FOLLOWUP_INDEX_KEY)];
}

export function seedNurtureMember(phone: string): void {
  redisSet(NURTURE_INDEX_KEY).add(phone);
}

export function seedDemoFollowUpMember(phone: string): void {
  redisSet(DEMO_FOLLOWUP_INDEX_KEY).add(phone);
}

export function installSpeed2LeadIntegrationMocks(): void {
  if (installed) {
    return;
  }
  installed = true;

  mock.module("~/server/sms/twilio", () => ({
    sendSms: async (to: string, body: string) => fakeSendSms(to, body),
  }));

  mock.module("~/server/speed2Lead/redis", () => ({
    getRedis: () => ({
      get: async (key: string) => capturedRedisStore.get(key) ?? null,
      set: async (key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
        if (opts?.nx && capturedRedisStore.has(key)) {
          return null;
        }
        capturedRedisStore.set(key, value);
        return "OK";
      },
      del: async (key: string) => {
        capturedRedisStore.delete(key);
      },
      sadd: async (key: string, member: string) => {
        redisSet(key).add(member);
      },
      srem: async (key: string, member: string) => {
        redisSet(key).delete(member);
      },
      smembers: async (key: string) => [...redisSet(key)],
    }),
  }));
}

export function resetSpeed2LeadIntegrationMocks(): void {
  capturedOutboundSms.length = 0;
  capturedRedisStore.clear();
  fakeSendSms = defaultFakeSendSms;
}

/** Reapply integration mocks after unrelated tests replace ~/server/speed2Lead/redis. */
export function forceReinstallSpeed2LeadIntegrationMocks(): void {
  installed = false;
  installSpeed2LeadIntegrationMocks();
}

export function resetCapturedOutboundSms(): void {
  capturedOutboundSms.length = 0;
}

beforeEach(() => {
  if (installed) {
    resetSpeed2LeadIntegrationMocks();
  }
});
