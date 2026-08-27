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

export type DemoFormEntry = {
  submitted: true;
  formSubmittedAt: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  recoveryStage?: number;
  recoveryNextAt?: string;
  recoveryResolved?: boolean;
};

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

export async function getDemoFormEntry(phoneOrEmail: string): Promise<DemoFormEntry | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const redis = getRedis();
  const normalized = phoneOrEmail.includes("@")
    ? demoFormEmailKey(phoneOrEmail)
    : demoFormPhoneKey(phoneOrEmail);
  const raw = await redis.get<DemoFormEntry | boolean>(normalized);
  if (!raw || raw === true) {
    return null;
  }
  return raw;
}

export async function saveDemoFormEntry(entry: DemoFormEntry): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  const keys = demoFormKeys(entry.email, entry.phone);
  await Promise.all([
    redis.set(keys.emailKey, entry, { ex: DEMO_FORM_TTL_SECONDS }),
    redis.set(keys.phoneKey, entry, { ex: DEMO_FORM_TTL_SECONDS }),
  ]);
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
    redis.get<DemoFormEntry | boolean>(keys.emailKey),
    redis.get<DemoFormEntry | boolean>(keys.phoneKey),
  ]);

  return Boolean(byEmail) || Boolean(byPhone);
}

export async function markDemoFormSubmitted(input: {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  businessName: string;
}): Promise<DemoFormEntry> {
  const entry: DemoFormEntry = {
    submitted: true,
    formSubmittedAt: new Date().toISOString(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    businessName: input.businessName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
  };

  await saveDemoFormEntry(entry);
  return entry;
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
