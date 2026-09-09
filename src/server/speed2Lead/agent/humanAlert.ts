import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { getRedis } from "~/server/speed2Lead/redis";
import type { HumanFollowUpReason } from "~/server/speed2Lead/agent/state";
import { sendSms } from "~/server/sms/twilio";

const INCIDENT_TTL_SECONDS = 60 * 60 * 24;

export type HumanAlertReason = HumanFollowUpReason | "identity_match_ambiguous";

function incidentKey(reason: string, subjectId: string): string {
  return `speed2lead:human-alert:${reason}:${subjectId}`;
}

export async function sendHumanAlert(args: {
  reason: HumanAlertReason;
  subjectId: string;
  body: string;
}): Promise<boolean> {
  const redis = getRedis();
  const claimed = await redis.set(incidentKey(args.reason, args.subjectId), "1", {
    nx: true,
    ex: INCIDENT_TTL_SECONDS,
  });
  if (!claimed) {
    return false;
  }

  const dest = getActiveProfile().humanEscalationConfig.phone.trim();
  if (!dest) {
    logAppointmentEvent("human_alert_sent", {
      reason: args.reason,
      subjectId: args.subjectId,
      skipped: "no_escalation_phone",
    });
    return true;
  }

  // Event-level NX dedupe only — not the prospect-facing lease machine.
  // A duplicate HUMAN_FOLLOW_UP alert can cause two humans to act on the
  // same prospect. The NX claim is the deterministic identity of this event.
  try {
    await sendSms(dest, args.body);
    logAppointmentEvent("human_alert_sent", {
      reason: args.reason,
      subjectId: args.subjectId,
    });
    return true;
  } catch (error) {
    logAppointmentEvent("human_alert_send_failed", {
      reason: args.reason,
      subjectId: args.subjectId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
