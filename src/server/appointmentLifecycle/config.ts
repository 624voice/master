import { SPEED2LEAD_BOOKING_URL } from "~/config/features";

export const APPOINTMENT_LIFECYCLE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
export const REMINDER_MIN_SPACING_MS = 30 * 60 * 1000; // 30 minutes after confirmation
/** Late catch-up only: eligible from T−24h through T−23h (never before T−24h). */
export const REMINDER_24H_LATE_CATCHUP_MS = 60 * 60 * 1000;
/** Late catch-up only: eligible from T−2h through T−1h30m (never before T−2h). */
export const REMINDER_2H_LATE_CATCHUP_MS = 30 * 60 * 1000;
export const DEFAULT_TIMEZONE = "America/Chicago";

export function isAppointmentLifecycleEnabled(): boolean {
  return process.env.APPOINTMENT_LIFECYCLE_ENABLED !== "false";
}

export { isGoogleServiceAccountCalendarConfigured } from "~/server/appointmentLifecycle/googleCredentials";
export {
  getGoogleCalendarAuthContext,
  isGoogleCalendarApiConfigured,
  isGoogleCalendarBookingConfigured,
  isGoogleOAuthConnectionActive,
  resolveGoogleCalendarId,
} from "~/server/appointmentLifecycle/googleCalendarAuth";

export function getCalendarSyncSecret(): string | undefined {
  return process.env.CALENDAR_SYNC_SECRET;
}

export function getBookingCalendarLink(): string {
  return process.env.SPEED2LEAD_BOOKING_URL ?? SPEED2LEAD_BOOKING_URL;
}

export function getGoogleCalendarId(): string | undefined {
  return process.env.GOOGLE_CALENDAR_ID;
}
