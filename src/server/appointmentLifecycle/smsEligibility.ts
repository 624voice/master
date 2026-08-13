import type { LeadIndexEntry } from "~/server/appointmentLifecycle/types";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { isOptedOut } from "~/server/speed2Lead/session";

export function leadHasSmsConsent(lead: LeadIndexEntry): boolean {
  return lead.smsConsent === true;
}

export async function canSendLifecycleSms(
  phone: string,
  lead?: LeadIndexEntry | null,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isOptedOut(phone)) {
    return { allowed: false, reason: "opt_out" };
  }

  if (!lead) {
    return { allowed: false, reason: "no_lead" };
  }

  if (!leadHasSmsConsent(lead)) {
    logAppointmentEvent("sms_suppressed_no_consent", {
      phone,
      source: lead.source,
    });
    return { allowed: false, reason: "no_consent" };
  }

  return { allowed: true };
}
