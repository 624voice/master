import { getSiteOrigin } from "~/server/speed2Lead/config";
import { getRedis } from "~/server/speed2Lead/redis";
import { isOptedOut } from "~/server/speed2Lead/session";
import {
  demoFormKeys,
  getDemoFormEntry,
  saveDemoFormEntry,
  type DemoFormEntry,
} from "~/server/vapi/demoUsage";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

const RECOVERY_INDEX_KEY = "speed2lead:demo:abandoned-recovery-pending";
const RECOVERY_STAGE_COUNT = 4;

const FIRST_RECOVERY_DELAY_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function demoResumeLink(): string {
  return `${getSiteOrigin()}/demo`;
}

function recoveryDueAt(entry: DemoFormEntry, stageIndex: number): string {
  const base = new Date(entry.formSubmittedAt).getTime();
  if (stageIndex === 0) return new Date(base + FIRST_RECOVERY_DELAY_MS).toISOString();
  if (stageIndex === 1) return new Date(base + DAY_MS).toISOString();
  if (stageIndex === 2) return new Date(base + 3 * DAY_MS).toISOString();
  if (stageIndex === 3) return new Date(base + 10 * DAY_MS).toISOString();
  throw new Error(`Invalid abandoned recovery stage: ${stageIndex}`);
}

export function buildAbandonedRecoveryMessage(entry: DemoFormEntry, stageIndex: number): string {
  const firstName = entry.firstName?.trim();
  const link = demoResumeLink();
  const hey = firstName ? `Hey ${firstName}, ` : "Hey, ";
  const hi = firstName ? `Hi ${firstName}. ` : "";

  if (stageIndex === 0) {
    return (
      `${hey}Chris with 624Voice. Looks like you started the Jessica demo but didn't get a chance to finish it. ` +
      "Want me to send you the link to pick it back up?"
    );
  }
  if (stageIndex === 1) {
    return (
      `${hi}Just bumping this — when you have a minute, you can finish the Jessica demo here: ${link}`
    );
  }
  if (stageIndex === 2) {
    const business = entry.businessName?.trim() || "your business";
    return (
      `${hi}If redoing the demo isn't convenient, I'm happy to talk through what Jessica could handle for ${business} directly. ` +
      `Or pick the demo back up here: ${link}`
    );
  }
  const business = entry.businessName?.trim() || "your business";
  return (
    "I'll close the loop for now so I don't keep chasing you. If you ever want to look at what Jessica could handle " +
    `for ${business}, just text me here and we can pick it back up.`
  );
}

async function enqueueRecovery(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(RECOVERY_INDEX_KEY, normalizePhone(phone));
}

async function dequeueRecovery(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(RECOVERY_INDEX_KEY, normalizePhone(phone));
}

export async function listPendingAbandonedRecoveryPhones(): Promise<string[]> {
  const redis = getRedis();
  const phones = (await redis.smembers(RECOVERY_INDEX_KEY)) as string[] | null;
  return phones ?? [];
}

export async function scheduleAbandonedDemoRecovery(entry: DemoFormEntry): Promise<void> {
  const phone = normalizePhone(entry.phone);
  const withRecovery: DemoFormEntry = {
    ...entry,
    recoveryStage: 0,
    recoveryNextAt: recoveryDueAt(entry, 0),
    recoveryResolved: false,
  };
  await saveDemoFormEntry(withRecovery);
  await enqueueRecovery(phone);
}

export async function cancelAbandonedDemoRecovery(phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  const entry = await getDemoFormEntry(normalized);
  if (!entry || entry.recoveryResolved) {
    await dequeueRecovery(normalized);
    return;
  }

  await saveDemoFormEntry({
    ...entry,
    recoveryResolved: true,
    recoveryNextAt: undefined,
  });
  await dequeueRecovery(normalized);
}

/** Cancel on any inbound SMS while abandoned recovery is pending. */
export async function maybeCancelAbandonedDemoRecoveryOnInbound(phone: string): Promise<void> {
  const entry = await getDemoFormEntry(phone);
  if (!entry || entry.recoveryResolved) {
    return;
  }
  await cancelAbandonedDemoRecovery(phone);
}

export async function processAbandonedDemoRecovery(now = new Date()): Promise<number> {
  const phones = await listPendingAbandonedRecoveryPhones();
  let sent = 0;

  for (const phone of phones) {
    const entry = await getDemoFormEntry(phone);
    if (!entry || entry.recoveryResolved) {
      await dequeueRecovery(phone);
      continue;
    }

    if (await isOptedOut(phone)) {
      await cancelAbandonedDemoRecovery(phone);
      continue;
    }

    const stageIndex = entry.recoveryStage ?? 0;
    if (stageIndex >= RECOVERY_STAGE_COUNT) {
      await cancelAbandonedDemoRecovery(phone);
      continue;
    }

    if (!entry.recoveryNextAt || new Date(entry.recoveryNextAt).getTime() > now.getTime()) {
      continue;
    }

    const message = buildAbandonedRecoveryMessage(entry, stageIndex);
    await sendSms(phone, message);

    const nextStage = stageIndex + 1;
    if (nextStage >= RECOVERY_STAGE_COUNT) {
      await saveDemoFormEntry({
        ...entry,
        recoveryStage: nextStage,
        recoveryNextAt: undefined,
        recoveryResolved: true,
      });
      await dequeueRecovery(phone);
    } else {
      await saveDemoFormEntry({
        ...entry,
        recoveryStage: nextStage,
        recoveryNextAt: recoveryDueAt(entry, nextStage),
        recoveryResolved: false,
      });
    }

    sent += 1;
  }

  return sent;
}

export { demoFormKeys };
