import { APPOINTMENT_LIFECYCLE_TTL_SECONDS } from "~/server/appointmentLifecycle/config";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
} from "~/server/appointmentLifecycle/types";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

const LIFECYCLE_PREFIX = "appointment:lifecycle:";
const LEAD_PHONE_PREFIX = "appointment:lead:phone:";
const LEAD_EMAIL_PREFIX = "appointment:lead:email:";
const ACTIVE_PHONE_PREFIX = "appointment:active:phone:";
const REMINDER_INDEX_KEY = "appointment:reminder-index";
const RECENT_LEADS_KEY = "appointment:recent-leads";
const SYNC_CURSOR_KEY = "appointment:sync:cursor";

function lifecycleKey(eventId: string): string {
  return `${LIFECYCLE_PREFIX}${eventId}`;
}

function leadPhoneKey(phone: string): string {
  return `${LEAD_PHONE_PREFIX}${normalizePhone(phone)}`;
}

function leadEmailKey(email: string): string {
  return `${LEAD_EMAIL_PREFIX}${email.trim().toLowerCase()}`;
}

function activePhoneKey(phone: string): string {
  return `${ACTIVE_PHONE_PREFIX}${normalizePhone(phone)}`;
}

export async function saveLeadIndex(entry: LeadIndexEntry): Promise<void> {
  const redis = getRedis();
  await redis.set(leadPhoneKey(entry.phone), entry, {
    ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
  });
  await redis.sadd(RECENT_LEADS_KEY, normalizePhone(entry.phone));
  if (entry.email) {
    await redis.set(leadEmailKey(entry.email), entry.phone, {
      ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
    });
  }
}

export async function getLeadByPhone(phone: string): Promise<LeadIndexEntry | null> {
  const redis = getRedis();
  return redis.get<LeadIndexEntry>(leadPhoneKey(phone));
}

export async function getLeadByEmail(email: string): Promise<LeadIndexEntry | null> {
  const redis = getRedis();
  const phone = await redis.get<string>(leadEmailKey(email));
  if (!phone) {
    return null;
  }
  return getLeadByPhone(phone);
}

export async function markSelfReportedBooking(phone: string): Promise<void> {
  const entry = await getLeadByPhone(phone);
  if (!entry) {
    return;
  }
  await saveLeadIndex({
    ...entry,
    selfReportedBookingAt: new Date().toISOString(),
  });
}

export async function getLifecycleRecord(
  eventId: string,
): Promise<AppointmentLifecycleRecord | null> {
  const redis = getRedis();
  return redis.get<AppointmentLifecycleRecord>(lifecycleKey(eventId));
}

export async function saveLifecycleRecord(record: AppointmentLifecycleRecord): Promise<void> {
  const redis = getRedis();
  await redis.set(lifecycleKey(record.calendarEventId), record, {
    ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
  });

  if (record.phone && isActiveLifecycle(record)) {
    await redis.set(activePhoneKey(record.phone), record.calendarEventId, {
      ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
    });
    await redis.sadd(REMINDER_INDEX_KEY, record.calendarEventId);
  }

  if (record.phone && !isActiveLifecycle(record)) {
    await redis.del(activePhoneKey(record.phone));
    await redis.srem(REMINDER_INDEX_KEY, record.calendarEventId);
  }
}

function isActiveLifecycle(record: AppointmentLifecycleRecord): boolean {
  return !["cancelled", "completed", "unmatched_booking"].includes(record.lifecycleStatus);
}

export async function getActiveLifecycleForPhone(
  phone: string,
): Promise<AppointmentLifecycleRecord | null> {
  const redis = getRedis();
  const eventId = await redis.get<string>(activePhoneKey(phone));
  if (!eventId) {
    return null;
  }
  const record = await getLifecycleRecord(eventId);
  if (!record || !isActiveLifecycle(record)) {
    await redis.del(activePhoneKey(phone));
    return null;
  }
  return record;
}

export async function getReminderIndexEventIds(): Promise<string[]> {
  const redis = getRedis();
  return ((await redis.smembers(REMINDER_INDEX_KEY)) as string[] | null) ?? [];
}

export async function getSyncCursor(): Promise<string | null> {
  const redis = getRedis();
  return redis.get<string>(SYNC_CURSOR_KEY);
}

export async function setSyncCursor(value: string): Promise<void> {
  const redis = getRedis();
  await redis.set(SYNC_CURSOR_KEY, value);
}

export async function findRecentLeadsByName(
  firstName: string,
  lastName?: string,
): Promise<LeadIndexEntry[]> {
  const normalizedFirst = firstName.trim().toLowerCase();
  const normalizedLast = lastName?.trim().toLowerCase();
  const redis = getRedis();
  const phones = ((await redis.smembers(RECENT_LEADS_KEY)) as string[] | null) ?? [];
  const matches: LeadIndexEntry[] = [];

  for (const phone of phones) {
    const entry = await getLeadByPhone(phone);
    if (!entry) continue;
    const entryFirst = entry.firstName.trim().toLowerCase();
    const entryLast = entry.lastName?.trim().toLowerCase();
    if (entryFirst !== normalizedFirst) continue;
    if (normalizedLast && entryLast && entryLast !== normalizedLast) continue;
    matches.push(entry);
  }

  return matches;
}
