import { SPEED2LEAD_BOOKING_URL } from "~/config/features";

export const APPOINTMENT_LIFECYCLE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const REMINDER_MIN_SPACING_MS = 30 * 60 * 1000; // 30 minutes after confirmation
export const REMINDER_24H_WINDOW_MS = 60 * 60 * 1000; // ±1 hour around 24h before
export const REMINDER_2H_WINDOW_MS = 30 * 60 * 1000; // ±30 min around 2h before
export const DEFAULT_TIMEZONE = "America/Chicago";

export function isAppointmentLifecycleEnabled(): boolean {
  return process.env.APPOINTMENT_LIFECYCLE_ENABLED !== "false";
}

export function isGoogleCalendarApiConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export function getCalendarSyncSecret(): string | undefined {
  return process.env.CALENDAR_SYNC_SECRET;
}

export function getBookingCalendarLink(): string {
  return process.env.SPEED2LEAD_BOOKING_URL ?? SPEED2LEAD_BOOKING_URL;
}

export function getGoogleCalendarId(): string | undefined {
  return process.env.GOOGLE_CALENDAR_ID;
}
