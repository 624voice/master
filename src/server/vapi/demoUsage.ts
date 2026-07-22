import { isRedisConfigured } from "~/server/speed2Lead/config";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

const DEMO_FORM_TTL_SECONDS = 60 * 60 * 24;

function demoEmailKey(email: string): string {
  return `vapi:demo:email:${email.trim().toLowerCase()}`;
}

function demoPhoneKey(phone: string): string {
  return `vapi:demo:phone:${normalizePhone(phone)}`;
}

function demoFormEmailKey(email: string): string {
  return `vapi:demo:form:email:${email.trim().toLowerCase()}`;
}

function demoFormPhoneKey(phone: string): string {
  return `vapi:demo:form:phone:${normalizePhone(phone)}`;
}

export function demoUsageKeys(email: string, phone: string) {
  return {
    emailKey: demoEmailKey(email),
    phoneKey: demoPhoneKey(phone),
  };
}

export function demoFormKeys(email: string, phone: string) {
  return {
    emailKey: demoFormEmailKey(email),
    phoneKey: demoFormPhoneKey(phone),
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

export async function hasSubmittedDemoForm(
  email: string,
  phone: string,
): Promise<boolean> {
  if (!isRedisConfigured()) {
    return true;
  }

  const redis = getRedis();
  const keys = demoFormKeys(email, phone);
  const [byEmail, byPhone] = await Promise.all([
    redis.get<boolean>(keys.emailKey),
    redis.get<boolean>(keys.phoneKey),
  ]);

  return byEmail === true || byPhone === true;
}

export async function markDemoFormSubmitted(
  email: string,
  phone: string,
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  const keys = demoFormKeys(email, phone);
  await Promise.all([
    redis.set(keys.emailKey, true, { ex: DEMO_FORM_TTL_SECONDS }),
    redis.set(keys.phoneKey, true, { ex: DEMO_FORM_TTL_SECONDS }),
  ]);
}

export async function canStartVoiceDemo(
  email: string,
  phone: string,
): Promise<boolean> {
  const [submitted, used] = await Promise.all([
    hasSubmittedDemoForm(email, phone),
    hasUsedVoiceDemo(email, phone),
  ]);

  return submitted && !used;
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
