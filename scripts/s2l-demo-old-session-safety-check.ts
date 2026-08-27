#!/usr/bin/env bun
/**
 * Scan the legacy Speed2Lead session store for demo conversations still in flight.
 * Used before deleting src/server/demoSpeed2Lead/.
 */
import { getRedis } from "~/server/speed2Lead/redis";
import { isOptedOut } from "~/server/speed2Lead/session";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

const SESSION_PREFIX = "speed2lead:session:";

type ActiveOldDemoSession = {
  phone: string;
  state: string;
  disposition?: string;
  schedulingStatus?: string;
  updatedAt?: string;
  ageHours: number;
  messageCount: number;
};

function isBooked(context: AnyConversationContext): boolean {
  if (context.disposition === "booked") return true;
  if (context.scheduling?.status === "confirmed") return true;
  return false;
}

function isTerminal(context: AnyConversationContext): boolean {
  if ("state" in context && context.state === "completed") return true;
  if (context.disposition === "declined") return true;
  return isBooked(context);
}

function isOldDemoEngineSession(context: AnyConversationContext): boolean {
  return context.flow === "demo";
}

async function listLegacySessionKeys(): Promise<string[]> {
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, {
      match: `${SESSION_PREFIX}*`,
      count: 200,
    });
    cursor = Number(nextCursor);
    keys.push(...batch);
  } while (cursor !== 0);
  return keys;
}

async function main() {
  const keys = await listLegacySessionKeys();
  const redis = getRedis();
  const active: ActiveOldDemoSession[] = [];
  const now = Date.now();

  for (const key of keys) {
    const raw = await redis.get<AnyConversationContext>(key);
    if (!raw) continue;
    if (!isOldDemoEngineSession(raw)) continue;
    if (await isOptedOut(raw.phone)) continue;
    if (isTerminal(raw)) continue;

    const updatedAt = raw.updatedAt;
    const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const ageHours = Number.isFinite(updatedMs) ? (now - updatedMs) / (1000 * 60 * 60) : -1;

    active.push({
      phone: raw.phone,
      state: "state" in raw ? raw.state : "unknown",
      disposition: raw.disposition,
      schedulingStatus: raw.scheduling?.status,
      updatedAt,
      ageHours: Math.round(ageHours * 10) / 10,
      messageCount: raw.messages?.length ?? 0,
    });
  }

  console.log(
    JSON.stringify(
      {
        scannedKeys: keys.length,
        activeOldDemoEngineSessions: active.length,
        sessions: active,
      },
      null,
      2,
    ),
  );

  process.exit(active.length > 0 ? 2 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
