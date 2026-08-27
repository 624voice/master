import { clearActiveLifecycleForPhone } from "~/server/appointmentLifecycle/store";
import { cancelAbandonedDemoRecovery } from "~/server/speed2Lead/agent/demoFlow/abandonedRecovery";
import { clearAgentSession } from "~/server/speed2Lead/agent/state";
import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import { removeNurtureFollowUp } from "~/server/speed2Lead/nurtureFollowUp";
import { clearOptedOut, clearSession } from "~/server/speed2Lead/session";
import { isSpeed2LeadTestPhone } from "~/server/speed2Lead/testPhoneAllowlist";
import { normalizePhone } from "~/server/sms/phone";

export type ResetSpeed2LeadTestPhoneResult = {
  phone: string;
  clearedSession: boolean;
  clearedOptOut: boolean;
  clearedDemoFollowUp: boolean;
  clearedActiveLifecycle: boolean;
};

export async function resetSpeed2LeadTestPhone(
  phone: string,
): Promise<ResetSpeed2LeadTestPhoneResult> {
  const normalized = normalizePhone(phone);
  if (!isSpeed2LeadTestPhone(normalized)) {
    throw new Error(
      "Refusing to reset phone that is not listed in SPEED2LEAD_TEST_PHONES",
    );
  }

  await clearSession(normalized);
  await clearAgentSession(normalized);
  await clearOptedOut(normalized);
  await cancelAbandonedDemoRecovery(normalized);
  await removeDemoFollowUp(normalized);
  await removeNurtureFollowUp(normalized);
  const clearedActiveLifecycle = await clearActiveLifecycleForPhone(normalized);

  return {
    phone: normalized,
    clearedSession: true,
    clearedOptOut: true,
    clearedDemoFollowUp: true,
    clearedActiveLifecycle,
  };
}
