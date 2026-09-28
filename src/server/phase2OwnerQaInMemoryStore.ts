/**
 * In-memory lead + Redis stand-ins for Phase 2 owner QA (Vercel Preview or local safe preview).
 */
import type { LeadPayload } from "~/server/leads";

const redisStore = new Map<string, unknown>();
const savedLeadEmails = new Set<string>();
const savedLeads: LeadPayload[] = [];

export function resetPhase2OwnerQaInMemoryStoreForTests(): void {
  redisStore.clear();
  savedLeadEmails.clear();
  savedLeads.length = 0;
}

export function recordPhase2OwnerQaLead(payload: LeadPayload): void {
  const emailKey = payload.email.toLowerCase();
  if (savedLeadEmails.has(emailKey)) return;
  savedLeadEmails.add(emailKey);
  savedLeads.push(payload);
}

export function getPhase2OwnerQaSavedLeads(): readonly LeadPayload[] {
  return savedLeads;
}

export class Phase2OwnerQaInMemoryRedis {
  async get<T>(key: string): Promise<T | null> {
    return (redisStore.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: unknown, _opts?: { ex?: number }): Promise<"OK"> {
    redisStore.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (redisStore.delete(key)) count += 1;
    }
    return count;
  }

  async eval<T = unknown>(
    _script: string,
    _numKeys: number,
    ...args: string[]
  ): Promise<T> {
    if (args.length <= 5) {
      return [1, 1, "allowed"] as T;
    }
    return ["a", "fresh", 1, 1, null] as T;
  }
}

let sharedRedis: Phase2OwnerQaInMemoryRedis | null = null;

export function getPhase2OwnerQaInMemoryRedis(): Phase2OwnerQaInMemoryRedis {
  if (!sharedRedis) sharedRedis = new Phase2OwnerQaInMemoryRedis();
  return sharedRedis;
}
