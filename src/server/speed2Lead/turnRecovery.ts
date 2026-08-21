import {
  buildBookingConfirmationMessage,
  buildSlotOfferMessage,
  finalizeCalendarLinkOutbound,
  genericRecoveryMessage,
  validateOutboundSms,
} from "~/server/speed2Lead/guardrails";
import { softCloseAckMessage } from "~/server/speed2Lead/messages";
import {
  buildDeterministicRecoveryReply,
  buildSchedulingPreferenceAsk,
  type SchedulingGateResult,
} from "~/server/speed2Lead/schedulingController";
import type { ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

function validateSafeOutbound(
  text: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  calendarLinkAllowed: boolean,
): string | null {
  const finalized = finalizeCalendarLinkOutbound(text, context, calendarLinkAllowed);
  if (!finalized) {
    return null;
  }
  const pass = validateOutboundSms(finalized, { session: context, toolState });
  return pass.ok ? pass.text : null;
}

function schedulingPreferenceRecovery(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  gateResult: SchedulingGateResult,
): string | null {
  if (!gateResult.schedulingIntent || toolState.bookingConfirmed) {
    return null;
  }
  if ((context.scheduling?.offeredSlots?.length ?? 0) > 0 || toolState.offeredSlots.length > 0) {
    return null;
  }
  return validateSafeOutbound(
    buildSchedulingPreferenceAsk(context.firstName, context.scheduling),
    context,
    toolState,
    gateResult.calendarLinkAllowed,
  );
}

function offeredSlotRecovery(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  calendarLinkAllowed: boolean,
): string | null {
  const slots =
    toolState.offeredSlots.length > 0
      ? toolState.offeredSlots
      : (context.scheduling?.offeredSlots ?? []);
  if (slots.length === 0) {
    return null;
  }
  return validateSafeOutbound(buildSlotOfferMessage(slots), context, toolState, calendarLinkAllowed);
}

function bookingConfirmationRecovery(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
): string | null {
  if (!toolState.bookingConfirmed || !toolState.bookingStart) {
    return null;
  }
  return validateSafeOutbound(
    buildBookingConfirmationMessage(toolState.bookingStart, context.firstName),
    context,
    toolState,
    false,
  );
}

/** Always returns customer-safe SMS copy; never calendar-link unless authorized. */
export function buildSafeTurnRecovery(args: {
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  gateResult: SchedulingGateResult;
}): string {
  const { context, toolState, gateResult } = args;

  if (context.disposition === "soft_closed") {
    return softCloseAckMessage();
  }

  if (context.scheduling?.status === "confirmed" || toolState.bookingConfirmed) {
    const confirmed = bookingConfirmationRecovery(context, toolState);
    if (confirmed) {
      return confirmed;
    }
    return softCloseAckMessage();
  }

  const deterministic = buildDeterministicRecoveryReply({
    context,
    toolState,
    gateResult,
  });
  if (deterministic?.trim()) {
    const safe = validateSafeOutbound(
      deterministic,
      context,
      toolState,
      gateResult.calendarLinkAllowed,
    );
    if (safe) {
      return safe;
    }
  }

  if (gateResult.forcedReply?.trim()) {
    const safe = validateSafeOutbound(
      gateResult.forcedReply,
      context,
      toolState,
      gateResult.calendarLinkAllowed,
    );
    if (safe) {
      return safe;
    }
  }

  const slotOffer = offeredSlotRecovery(context, toolState, gateResult.calendarLinkAllowed);
  if (slotOffer) {
    return slotOffer;
  }

  const preference = schedulingPreferenceRecovery(context, toolState, gateResult);
  if (preference) {
    return preference;
  }

  if (gateResult.gateApplied && gateResult.schedulingIntent) {
    const ask = validateSafeOutbound(
      buildSchedulingPreferenceAsk(context.firstName, context.scheduling),
      context,
      toolState,
      false,
    );
    if (ask) {
      return ask;
    }
  }

  return genericRecoveryMessage(context);
}

export function finalizeSafeTurnReply(args: {
  reply: string;
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  gateResult: SchedulingGateResult;
}): { reply: string; context: AnyConversationContext } {
  const safe = validateSafeOutbound(
    args.reply,
    args.context,
    args.toolState,
    args.gateResult.calendarLinkAllowed,
  );
  if (safe) {
    return { reply: safe, context: args.context };
  }

  return {
    reply: buildSafeTurnRecovery({
      context: args.context,
      toolState: args.toolState,
      gateResult: args.gateResult,
    }),
    context: args.context,
  };
}
