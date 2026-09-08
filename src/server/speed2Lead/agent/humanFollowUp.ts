import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import { cancelBookingLinkFollowUps } from "~/server/speed2Lead/agent/bookingLinkFollowUps";
import {
  saveAgentSession,
  type AgentSession,
  type HumanFollowUpReason,
} from "~/server/speed2Lead/agent/state";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";

export async function cancelAllAutomation(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelPendingPainPrompt(session);
  updated = await cancelPendingNoResponseCampaign(updated);
  updated = await cancelBookingLinkFollowUps(updated);
  return updated;
}

export async function enterHumanFollowUp(
  session: AgentSession,
  reason: HumanFollowUpReason,
): Promise<AgentSession> {
  const priorStage = session.stage;
  const priorFollowUpStage = session.bookingLinkFollowUpStage;
  const cancelled = await cancelAllAutomation(session);
  const next: AgentSession = {
    ...cancelled,
    humanFollowUpPriorStage: priorStage,
    humanFollowUpPriorFollowUpStage: priorFollowUpStage,
    stage: "handoff",
    humanFollowUpReason: reason,
    humanFollowUpAt: new Date().toISOString(),
  };
  logAppointmentEvent("human_follow_up_created", {
    phone: session.phone,
    reason,
    priorStage,
  });
  return next;
}

export async function persistHumanFollowUp(
  session: AgentSession,
  reason: HumanFollowUpReason,
): Promise<AgentSession> {
  const next = await enterHumanFollowUp(session, reason);
  await saveAgentSession(next);
  return next;
}
