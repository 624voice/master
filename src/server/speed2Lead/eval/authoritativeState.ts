import { hydrateToolStateFromContext } from "~/server/speed2Lead/schedulingController";
import { createInitialToolState, type ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

/** Reads persisted session scheduling state — same source production uses after the gate. */
export function observeAuthoritativeSchedulingState(
  context: AnyConversationContext,
): ToolExecutionState {
  return hydrateToolStateFromContext(context, createInitialToolState());
}

export type SchedulingEvidence = {
  finalState: ToolExecutionState;
  peakOfferedSlots: string[];
  availabilityAttempts: number;
  lastOfferedSlotKey?: string;
  schedulingStatus?: string;
};

export function collectSchedulingEvidence(
  finalContext: AnyConversationContext,
  toolStatesByTurn: ToolExecutionState[] = [],
): SchedulingEvidence {
  const finalState = observeAuthoritativeSchedulingState(finalContext);
  let peakOfferedSlots = finalState.offeredSlots;

  for (const turnState of toolStatesByTurn) {
    if (turnState.offeredSlots.length > peakOfferedSlots.length) {
      peakOfferedSlots = turnState.offeredSlots;
    }
  }

  return {
    finalState,
    peakOfferedSlots,
    availabilityAttempts: finalContext.scheduling?.availabilityAttempts ?? 0,
    lastOfferedSlotKey: finalContext.scheduling?.lastOfferedSlotKey,
    schedulingStatus: finalContext.scheduling?.status,
  };
}

export function schedulingOfferEvidenceMet(evidence: SchedulingEvidence): boolean {
  if (evidence.finalState.bookingConfirmed) return true;
  if (evidence.peakOfferedSlots.length > 0) return true;
  if (evidence.schedulingStatus === "slots_offered") return true;
  if (evidence.lastOfferedSlotKey) return true;
  return evidence.availabilityAttempts > 0 && evidence.peakOfferedSlots.length > 0;
}
