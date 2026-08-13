import {
  REMINDER_24H_WINDOW_MS,
  REMINDER_2H_WINDOW_MS,
  REMINDER_MIN_SPACING_MS,
} from "~/server/appointmentLifecycle/config";
import type { AppointmentLifecycleRecord, ReminderKind } from "~/server/appointmentLifecycle/types";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_2H = 2 * 60 * 60 * 1000;

export function msUntilAppointment(record: AppointmentLifecycleRecord, now = new Date()): number {
  return new Date(record.appointmentStart).getTime() - now.getTime();
}

export function shouldSend24hReminder(
  record: AppointmentLifecycleRecord,
  now = new Date(),
): boolean {
  if (record.reminder24hSentAt) return false;
  if (record.lifecycleStatus === "cancelled") return false;
  if (!record.confirmationSentAt) return false;

  const until = msUntilAppointment(record, now);
  if (until <= MS_2H) return false; // booking within 2h — skip both reminders per spec

  const confirmationAge = now.getTime() - new Date(record.confirmationSentAt).getTime();
  if (confirmationAge < REMINDER_MIN_SPACING_MS) return false;

  const target = MS_24H;
  return Math.abs(until - target) <= REMINDER_24H_WINDOW_MS;
}

export function shouldSend2hReminder(
  record: AppointmentLifecycleRecord,
  now = new Date(),
): boolean {
  if (record.reminder2hSentAt) return false;
  if (record.lifecycleStatus === "cancelled") return false;
  if (!record.confirmationSentAt) return false;

  const until = msUntilAppointment(record, now);
  if (until <= 0) return false;

  const confirmationAge = now.getTime() - new Date(record.confirmationSentAt).getTime();
  if (confirmationAge < REMINDER_MIN_SPACING_MS) return false;

  const target = MS_2H;
  return until <= target + REMINDER_2H_WINDOW_MS && until >= target - REMINDER_2H_WINDOW_MS;
}

export function shouldSkip24hForLeadTime(
  record: AppointmentLifecycleRecord,
  confirmedAt = new Date(),
): boolean {
  const until = new Date(record.appointmentStart).getTime() - confirmedAt.getTime();
  return until < MS_24H;
}

export function shouldSkip2hForLeadTime(
  record: AppointmentLifecycleRecord,
  confirmedAt = new Date(),
): boolean {
  const until = new Date(record.appointmentStart).getTime() - confirmedAt.getTime();
  return until < MS_2H;
}

export function nextReminderKind(
  record: AppointmentLifecycleRecord,
  now = new Date(),
): ReminderKind | null {
  if (shouldSend24hReminder(record, now)) return "24h";
  if (shouldSend2hReminder(record, now)) return "2h";
  return null;
}

export function isMeetingDue(record: AppointmentLifecycleRecord, now = new Date()): boolean {
  const start = new Date(record.appointmentStart).getTime();
  return now.getTime() >= start && record.lifecycleStatus !== "cancelled";
}

export function isMeetingCompleted(record: AppointmentLifecycleRecord, now = new Date()): boolean {
  const end = new Date(record.appointmentEnd).getTime();
  return now.getTime() >= end && record.lifecycleStatus !== "cancelled";
}
