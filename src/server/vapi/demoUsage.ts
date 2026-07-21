import { isRedisConfigured } from "~/server/speed2Lead/config";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

function demoEmailKey(email: string): string {
  return `vapi:demo:email:${email.trim().toLowerCase()}`;
}

function demoPhoneKey(phone: string): string {
  return `vapi:demo:phone:${normalizePhone(phone)}`;
}

export function demoUsageKeys(email: string, phone: string) {
  return {
    emailKey: demoEmailKey(email),
    phoneKey: demoPhoneKey(phone),
  };
}

export async function hasUsedVoiceDemo(
  email: string,
  phone: string,
): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  const redis = getRedis();
  const keys = demoUsageKeys(email, phone);
  const [byEmail, byPhone] = await Promise.all([
    redis.get<boolean>(keys.emailKey),
    redis.get<boolean>(keys.phoneKey),
  ]);

  return byEmail === true || byPhone === true;
}

export async function markVoiceDemoUsed(
  email: string,
  phone: string,
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  const keys = demoUsageKeys(email, phone);
  await Promise.all([
    redis.set(keys.emailKey, true),
    redis.set(keys.phoneKey, true),
  ]);
}
