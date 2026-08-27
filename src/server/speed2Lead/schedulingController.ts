/**
 * @deprecated Scheduling orchestration moved to schedulingGate.ts + scheduling/service.ts.
 * This module re-exports the canonical gate for backward compatibility.
 */
export {
  allowCalendarLinkFallback,
  buildDeterministicRecoveryReply,
  buildSchedulingPreferenceAsk,
  buildSchedulingResumeReply,
  enforceSchedulingGate,
  hydrateToolStateFromContext,
  isActiveV2Scheduling,
  isAvailabilityFetchAuthorized,
  persistSchedulingToolState,
  planSchedulingGate,
  requiresDeterministicSchedulingCompletion,
  resolveAuthoritativeSchedulingReply,
  resolveOfferedSlotSelection,
  schedulingRequestKey,
  selectOutboundSchedulingReply,
  stripUnauthorizedCalendarLink,
  type SchedulingGateAction,
  type SchedulingGatePlan,
  type SchedulingGateResult,
} from "~/server/speed2Lead/schedulingGate";
