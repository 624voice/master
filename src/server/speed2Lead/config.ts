import {
  SPEED2LEAD_BOOKING_URL,
  SITE_ORIGIN,
} from "~/config/features";
import { resolveSpeed2LeadEnvFlag } from "~/server/speed2Lead/envFlags";

export function isRedisConfigured(): boolean {
  return (
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function isSpeed2LeadEnabled(): boolean {
  return (
    process.env.SPEED2LEAD_ENABLED !== "false" &&
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_FROM_NUMBER) &&
    isRedisConfigured()
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

export function isSpeed2LeadLlmEnabled(): boolean {
  return resolveSpeed2LeadEnvFlag("SPEED2LEAD_LLM_ENABLED");
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getSpeed2LeadLlmModel(): string {
  return process.env.SPEED2LEAD_LLM_MODEL ?? "gpt-4.1-mini";
}

export function getSpeed2LeadLlmMaxToolIterations(): number {
  const parsed = Number(process.env.SPEED2LEAD_LLM_MAX_TOOL_ITERATIONS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

export const SPEED2LEAD_LLM_MAX_SMS_LENGTH = 320;
