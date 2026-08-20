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
const SYNC_CURSOR_KEY = "appointment:sync:cursor";

function lifecycleKey(eventId: string): string {
  return `${LIFECYCLE_PREFIX}${eventId}`;
}

function leadPhoneKey(phone: string): string {
  return `${LEAD_PHONE_PREFIX}${normalizePhone(phone)}`;
}

function leadEmailKey(email: string): string {
  return `${LEAD_EMAIL_PREFIX}${email.trim().toLowerCase}`;
}

function activePhoneKey(phone: string): string {
  return `${ACTIVE_PHONE_PREFIX}${normalizePhone(phone)}`;
}

function leadIdentity(entry: LeadIndexEntry): string {
  return `${entry.phone}:${entry.email ?? ""}:${entry.source}:${entry.registeredAt}`;
}

export function isActiveLifecycle(record: AppointmentLifecycleRecord): boolean {
  return !["cancelled", "completed", "unmatched_booking", "superseded"].includes(
    record.lifecycleStatus,
  );
}

export function shouldSendReminders(record: AppointmentLifecycleRecord, now = new Date()): boolean {
  if (!isActiveLifecycle(record)) return false;
  if (record.remindersSuppressed) return false;
  if (record.lifecycleStatus === "reschedule_pending") return false;
  return true;
}

export async function saveLeadIndex(entry: LeadIndexEntry): Promise<void> {
  const redis = getRedis();
  const phone = normalizePhone(entry.phone);
  const existing =
    ((await redis.get<LeadIndexEntry[]>(leadPhoneKey(phone))) as LeadIndexEntry[] | null) ?? [];
  const identity = leadIdentity(entry);
  const withoutDuplicate = existing.filter((item) => leadIdentity(item) !== identity);
  const updated = [...withoutDuplicate, entry];
  await redis.set(leadPhoneKey(phone), updated, {
    ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
  });
  if (entry.email) {
    await redis.set(leadEmailKey(entry.email), phone, {
      ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
    });
  }
}

export async function getLeadsByPhone(phone: string): Promise<LeadIndexEntry[]> {
  const redis = getRedis();
  const normalized = normalizePhone(phone);
  return ((await redis.get<LeadIndexEntry[]>(leadPhoneKey(normalized))) as LeadIndexEntry[] | null) ?? [];
}

export async function getLeadByPhone(phone: string): Promise<LeadIndexEntry | null> {
  const leads = await getLeadsByPhone(phone);
  if (leads.length === 1) {
    return leads[0]!;
  }
  return null;
}

export async function getLeadByEmail(email: string): Promise<LeadIndexEntry | null> {
  const redis = getRedis();
  const phone = await redis.get<string>(leadEmailKey(email));
  if (!phone) {
    return null;
  }
  const leads = await getLeadsByPhone(phone);
  const normalizedEmail = email.trim().toLowerCase();
  return leads.find((l) => l.email?.trim().toLowerCase() === normalizedEmail) ?? null;
}

export async function markSelfReportedBooking(phone: string): Promise<void> {
  const leads = await getLeadsByPhone(phone);
  if (leads.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  for (const entry of leads) {
    await saveLeadIndex({
      ...entry,
      selfReportedBookingAt: now,
    });
  }
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

  const active = isActiveLifecycle(record);

  if (record.phone && active) {
    await redis.set(activePhoneKey(record.phone), record.calendarEventId, {
      ex: APPOINTMENT_LIFECYCLE_TTL_SECONDS,
    });
    await redis.sadd(REMINDER_INDEX_KEY, record.calendarEventId);
  }

  if (record.phone && !active) {
    const currentActive = await redis.get<string>(activePhoneKey(record.phone));
    if (currentActive === record.calendarEventId) {
      await redis.del(activePhoneKey(record.phone));
    }
    await redis.srem(REMINDER_INDEX_KEY, record.calendarEventId);
  }

  if (!active) {
    await redis.srem(REMINDER_INDEX_KEY, record.calendarEventId);
  }
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

/** Clears the active lifecycle pointer for one phone (does not delete lifecycle records). */
export async function clearActiveLifecycleForPhone(phone: string): Promise<boolean> {
  const redis = getRedis();
  const normalized = normalizePhone(phone);
  const eventId = await redis.get<string>(activePhoneKey(normalized));
  if (!eventId) {
    return false;
  }
  await redis.del(activePhoneKey(normalized));
  await redis.srem(REMINDER_INDEX_KEY, eventId);
  return true;
}

export async function supersedeActiveLifecycle(
  oldRecord: AppointmentLifecycleRecord,
  newEventId: string,
  options: { manualCleanupRequired?: boolean } = {},
): Promise<AppointmentLifecycleRecord> {
  const superseded: AppointmentLifecycleRecord = {
    ...oldRecord,
    lifecycleStatus: "superseded",
    rescheduledToEventId: newEventId,
    remindersSuppressed: true,
    supersededAt: new Date().toISOString(),
    manualCleanupRequired: options.manualCleanupRequired ?? oldRecord.manualCleanupRequired,
    updatedAt: new Date().toISOString(),
  };
  await saveLifecycleRecord(superseded);
  return superseded;
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

export async function getLeadForLifecycle(
  record: AppointmentLifecycleRecord,
): Promise<LeadIndexEntry | null> {
  if (record.email) {
    const byEmail = await getLeadByEmail(record.email);
    if (byEmail) {
      return byEmail;
    }
  }

  if (!record.phone) {
    return null;
  }

  const leads = await getLeadsByPhone(record.phone);
  if (leads.length === 1) {
    return leads[0]!;
  }

  if (record.source) {
    return leads.find((lead) => lead.source === record.source) ?? null;
  }

  return null;
}

const RESCHEDULE_PENDING_MAX_MS = 48 * 60 * 60 * 1000;

export function shouldExpireReschedulePending(
  record: AppointmentLifecycleRecord,
  now = new Date(),
): boolean {
  if (record.lifecycleStatus !== "reschedule_pending" || !record.reschedulePendingAt) {
    return false;
  }
  const pendingMs = now.getTime() - new Date(record.reschedulePendingAt).getTime();
  return pendingMs >= RESCHEDULE_PENDING_MAX_MS;
}

export async function expireReschedulePendingIfStale(
  record: AppointmentLifecycleRecord,
  now = new Date(),
): Promise<AppointmentLifecycleRecord> {
  if (!shouldExpireReschedulePending(record, now)) {
    return record;
  }

  const appointmentStillFuture = new Date(record.appointmentStart).getTime() > now.getTime();
  const restored: AppointmentLifecycleRecord = {
    ...record,
    lifecycleStatus: appointmentStillFuture ? "confirmed" : "completed",
    remindersSuppressed: false,
    reschedulePendingAt: undefined,
    updatedAt: now.toISOString(),
  };
  await saveLifecycleRecord(restored);
  return restored;
}
