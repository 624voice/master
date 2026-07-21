import {
  SPEED2LEAD_BOOKING_URL,
  SITE_ORIGIN,
} from "~/config/features";

export function isSpeed2LeadEnabled(): boolean {
  return (
    process.env.SPEED2LEAD_ENABLED !== "false" &&
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_FROM_NUMBER) &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function getSiteOrigin(): string {
  return process.env.SITE_ORIGIN ?? SITE_ORIGIN;
}

export function getBookingUrl(): string {
  return process.env.SPEED2LEAD_BOOKING_URL ?? SPEED2LEAD_BOOKING_URL;
}

export const REPORT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
