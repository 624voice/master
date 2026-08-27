import {
  detectTimingPushback,
  isGenericAcknowledgment,
  isSubstantiveReengagement,
} from "~/server/speed2Lead/inboundDisposition";
import { classifyGlobalIntent, getSignals } from "~/server/speed2Lead/globalIntents";
import * as messages from "~/server/speed2Lead/messages";
import {
  shouldAskPersonalizationQuestion,
  shouldSendCalendarNow,
  shouldSkipPriorityQuestion,
  type PainCategory,
} from "~/server/speed2Lead/naturalLanguage";
import type { ConversationContext, ConversationState } from "~/server/speed2Lead/types";

type TransitionResult = {
  context: ConversationContext;
  reply: string;
};

const FREE_FORM_STATES = new Set<ConversationState>([
  "awaiting_priority",
  "awaiting_answering_service_gap",
  "awaiting_office_staff_task",
]);

function withState(
  context: ConversationContext,
  state: ConversationState,
  extra: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    ...context,
    ...extra,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function withInbound(
  context: ConversationContext,
  inboundText: string,
  extra: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    ...context,
    ...extra,
    lastCustomerMessage: inboundText.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function complete(
  context: ConversationContext,
  reply: string,
  extra: Partial<ConversationContext> = {},
): TransitionResult {
  return {
    context: withState(context, "completed", extra),
    reply,
  };
}

function contextSignals(context: ConversationContext) {
  return {
    detectedPains: context.detectedPains,
    lastCustomerMessage: context.lastCustomerMessage,
  };
}

function handleGlobalIntents(
  context: ConversationContext,
  inboundText: string,
): TransitionResult | null {
  const intent = classifyGlobalIntent(inboundText);

  switch (intent) {
    case "stop":
    case "decline":
      return complete(context, messages.declineMessage());
    case "schedule_ready":
      return complete(context, messages.scheduleYesMessage(context));
    case "price":
      return complete(context, messages.priceMessage(context));
    case "tell_me_more":
      return complete(context, messages.faqMessage(context));
    case "request_report":
      return {
        context: withState(context, "awaiting_report_assumptions"),
        reply: messages.reportLinkMessage(context),
      };
    case "not_ready":
      return {
        context: withState(context, "awaiting_not_ready_summary"),
        reply: messages.notReadyMessage(context),
      };
    case "answering_service":
      return {
        context: withState(context, "awaiting_answering_service_gap"),
        reply: messages.answeringServiceQuestion(context),
      };
    case "office_staff":
      return {
        context: withState(context, "awaiting_office_staff_task"),
        reply: messages.officeStaffQuestion(context),
      };
    default:
      return null;
  }
}

function handleProblemResponse(
  context: ConversationContext,
  inboundText: string,
): TransitionResult {
  const signals = getSignals(inboundText);

  if (context.disposition === "soft_closed") {
    if (isGenericAcknowledgment(inboundText) && !isSubstantiveReengagement(inboundText)) {
      return { context, reply: messages.softCloseAckMessage() };
    }
    if (!isSubstantiveReengagement(inboundText)) {
      return { context, reply: messages.softCloseAckMessage() };
    }
  }

  if (detectTimingPushback(inboundText)) {
    return {
      context: withState(withInbound(context, inboundText), context.state, {
        disposition: "soft_closed" as const,
      }),
      reply: messages.softCloseMessage(context),
    };
  }

  if (signals.identityQuestion) {
    return {
      context,
      reply: messages.identityAnswerMessage(context),
    };
  }

  const ctx = withInbound(context, inboundText);
  const ctxSignals = contextSignals(ctx);

  if (shouldSendCalendarNow(signals, ctxSignals)) {
    return complete(ctx, messages.urgentCalendarMessage(ctx), {
      detectedPains: signals.pains.length > 0 ? signals.pains : ctx.detectedPains,
    });
  }

  if (shouldAskPersonalizationQuestion(signals, ctxSignals)) {
    return {
      context: withState(ctx, "awaiting_priority"),
      reply: messages.personalizeQuestion(ctx),
    };
  }

  if (signals.pains.length > 0) {
    if (shouldSkipPriorityQuestion(signals, ctxSignals)) {
      return complete(ctx, messages.calendarMessage(ctx), {
        detectedPains: signals.pains,
      });
    }
    return {
      context: withState(ctx, "awaiting_priority", { detectedPains: signals.pains }),
      reply: messages.priorityQuestion(ctx),
    };
  }

  if (signals.vague) {
    return {
      context: withState(ctx, "awaiting_priority"),
      reply: messages.clarifyProblemQuestion(ctx),
    };
  }

  return complete(ctx, messages.calendarMessage(ctx));
}

function handlePriorityResponse(
  context: ConversationContext,
  inboundText: string,
): TransitionResult {
  const ctx = withInbound(context, inboundText);
  const signals = getSignals(inboundText);
  const mergedPains = signals.pains.length > 0 ? signals.pains : ctx.detectedPains;

  if (shouldSendCalendarNow(signals, { ...contextSignals(ctx), detectedPains: mergedPains })) {
    return complete(ctx, messages.urgentCalendarMessage(ctx), { detectedPains: mergedPains });
  }

  return complete(ctx, messages.calendarMessage(ctx), { detectedPains: mergedPains });
}

function migrateLegacyState(state: string): ConversationState {
  return "awaiting_problem";
}

export function advanceConversation(
  context: ConversationContext,
  inboundText: string,
): TransitionResult {
  const state =
    context.state === "awaiting_goal" || !isKnownState(context.state)
      ? migrateLegacyState(context.state)
      : context.state;

  const workingContext = state === context.state ? context : withState(context, state);

  if (!FREE_FORM_STATES.has(workingContext.state)) {
    const global = handleGlobalIntents(workingContext, inboundText);
    if (global) {
      return global;
    }
  }

  switch (workingContext.state) {
    case "awaiting_problem":
      return handleProblemResponse(workingContext, inboundText);

    case "awaiting_priority":
      return handlePriorityResponse(workingContext, inboundText);

    case "awaiting_faq_followup":
      return complete(
        withInbound(workingContext, inboundText),
        messages.scheduleYesMessage(workingContext),
      );

    case "awaiting_report_assumptions":
      return complete(
        withInbound(workingContext, inboundText),
        messages.scheduleYesMessage(workingContext),
      );

    case "awaiting_not_ready_summary": {
      const signals = getSignals(inboundText);
      if (signals.yes) {
        return complete(
          withInbound(workingContext, inboundText),
          messages.notReadySummaryMessage(workingContext),
        );
      }
      return complete(withInbound(workingContext, inboundText), messages.declineMessage());
    }

    case "awaiting_answering_service_gap":
      return complete(
        withInbound(workingContext, inboundText),
        messages.answeringServiceFollowUp(workingContext),
      );

    case "awaiting_office_staff_task":
      return complete(
        withInbound(workingContext, inboundText),
        messages.officeStaffFollowUp(workingContext),
      );

    case "completed":
      return handleProblemResponse(workingContext, inboundText);

    default:
      return handleProblemResponse(withState(workingContext, "awaiting_problem"), inboundText);
  }
}

function isKnownState(state: string): state is ConversationState {
  return [
    "awaiting_problem",
    "awaiting_priority",
    "awaiting_faq_followup",
    "awaiting_report_assumptions",
    "awaiting_not_ready_summary",
    "awaiting_answering_service_gap",
    "awaiting_office_staff_task",
    "completed",
  ].includes(state);
}

export type { PainCategory };
