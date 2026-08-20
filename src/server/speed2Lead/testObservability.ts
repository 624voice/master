import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";
import {
  isSpeed2LeadTestPhone,
  isSpeed2LeadTestPhoneAllowlistActive,
} from "~/server/speed2Lead/testPhoneAllowlist";
import type { SchedulingGatePlan } from "~/server/speed2Lead/schedulingController";

export type Speed2LeadTestLogEvent =
  | "inbound_received"
  | "llm_turn_start"
  | "scheduling_state_before"
  | "scheduling_gate_action"
  | "tool_call"
  | "availability_result"
  | "booking_attempt"
  | "booking_result"
  | "guardrail_result"
  | "forced_reply"
  | "rules_fallback"
  | "outbound_sent"
  | "scheduling_state_after"
  | "turn_complete";

const SENSITIVE_KEY_RE =
  /(?:api[_-]?key|secret|token|password|authorization|private[_-]?key|email|firstName|businessName|reportUrl)/i;

export function maskPhoneForLog(phone: string): string {
  const normalized = normalizePhone(phone);
  return `***${normalized.slice(-4)}`;
}

export function shouldLogSpeed2LeadTestPhone(phone: string): boolean {
  return isSpeed2LeadTestPhoneAllowlistActive() && isSpeed2LeadTestPhone(phone);
}

export function summarizeSchedulingState(
  context: AnyConversationContext | null | undefined,
): Record<string, string | number | boolean | undefined> {
  const scheduling = context?.scheduling;
  return {
    status: scheduling?.status ?? "idle",
    offeredSlotCount: scheduling?.offeredSlots?.length ?? 0,
    hasSelectedStart: Boolean(scheduling?.selectedStart),
    availabilityAttempts: scheduling?.availabilityAttempts ?? 0,
    bookingAttempts: scheduling?.bookingAttempts ?? 0,
    calendarUnavailable: scheduling?.calendarUnavailable ?? false,
    activeRequestKey: scheduling?.activeRequestKey,
  };
}

function sanitizeLogDetails(
  details: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  const sanitized: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    if (typeof value === "string" && value.length > 160) {
      sanitized[key] = `${value.slice(0, 157)}...`;
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export function summarizeGateAction(plan: SchedulingGatePlan): string {
  const action = plan.action;
  if (action.type === "none") return "none";
  if (action.type === "ask_preference") return "ask_preference";
  if (action.type === "book_appointment") return `book_appointment:${action.reason}`;
  if (action.type === "get_availability") return `get_availability:${action.reason}`;
  return `get_availability_for_request:${action.reason}`;
}

export function logSpeed2LeadTestEvent(
  phone: string,
  event: Speed2LeadTestLogEvent,
  details: Record<string, string | number | boolean | undefined> = {},
): void {
  if (!shouldLogSpeed2LeadTestPhone(phone)) {
    return;
  }

  console.log(
    JSON.stringify({
      component: "speed2LeadOrchestrator",
      testMode: true,
      event,
      at: new Date().toISOString(),
      phone: maskPhoneForLog(phone),
      ...sanitizeLogDetails(details),
    }),
  );
}
