import { classifyGlobalIntent, getSignals } from "~/server/speed2Lead/globalIntents";
import {
  shouldSendCalendarNow,
  type PainCategory,
} from "~/server/speed2Lead/naturalLanguage";
import * as messages from "~/server/demoSpeed2Lead/messages";
import type { DemoConversationContext, DemoConversationState } from "~/server/demoSpeed2Lead/types";

export type TransitionResult = {
  context: DemoConversationContext;
  reply: string;
};

const FREE_FORM_STATES = new Set<DemoConversationState>([
  "awaiting_workload",
  "awaiting_objection",
  "awaiting_negative_feedback",
  "awaiting_demo_error_detail",
  "awaiting_customization",
  "awaiting_orchestration",
  "awaiting_office_staff_task",
  "awaiting_answering_service_gap",
  "awaiting_already_ai_handling",
  "awaiting_already_ai_gaps",
  "awaiting_not_ready_followup",
  "awaiting_just_testing_part",
]);

function withState(
  context: DemoConversationContext,
  state: DemoConversationState,
  extra: Partial<DemoConversationContext> = {},
): DemoConversationContext {
  return {
    ...context,
    ...extra,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function withInbound(
  context: DemoConversationContext,
  inboundText: string,
  extra: Partial<DemoConversationContext> = {},
): DemoConversationContext {
  return {
    ...context,
    ...extra,
    lastCustomerMessage: inboundText.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function cancelFollowUps(): Partial<DemoConversationContext> {
  return { nextFollowUpAt: undefined };
}

function complete(
  context: DemoConversationContext,
  reply: string,
  extra: Partial<DemoConversationContext> = {},
): TransitionResult {
  const bookingLinkSent = extra.bookingLinkSent ?? reply.includes(context.bookingUrl);
  return {
    context: withState(context, "completed", {
      ...extra,
      bookingLinkSent,
      lastAgentMessage: reply,
      nextFollowUpAt: undefined,
    }),
    reply,
  };
}

function handleGlobalIntents(
  context: DemoConversationContext,
  inboundText: string,
): TransitionResult | null {
  const intent = classifyGlobalIntent(inboundText);
  const ctx = withInbound(context, inboundText, cancelFollowUps());

  switch (intent) {
    case "stop":
    case "decline":
      return complete(ctx, messages.declineMessage(), { customerDeclined: true });
    case "meeting_booked":
      return complete(ctx, messages.meetingBookedMessage(ctx), { meetingBooked: true });
    case "schedule_ready":
      return complete(ctx, messages.shortMeetingReadyMessage(ctx), { bookingLinkSent: true });
    case "price":
      return complete(ctx, messages.priceMessage(ctx), { bookingLinkSent: true });
    case "faq_624voice":
      return {
        context: withState(ctx, "awaiting_faq_624voice"),
        reply: messages.faq624VoiceMessage(ctx),
      };
    case "customization":
      return {
        context: withState(ctx, "awaiting_customization"),
        reply: messages.customizationMessage(ctx),
      };
    case "orchestration":
      return {
        context: withState(ctx, "awaiting_orchestration"),
        reply: messages.orchestrationMessage(ctx),
      };
    case "office_staff":
      return {
        context: withState(ctx, "awaiting_office_staff_task"),
        reply: messages.officeStaffQuestion(ctx),
      };
    case "answering_service":
      return {
        context: withState(ctx, "awaiting_answering_service_gap"),
        reply: messages.answeringServiceQuestion(ctx),
      };
    case "already_uses_ai":
      return {
        context: withState(ctx, "awaiting_already_ai_handling"),
        reply: messages.alreadyAiHandlingQuestion(ctx),
      };
    case "just_testing":
      return {
        context: withState(ctx, "awaiting_just_testing_followup"),
        reply: messages.justTestingMessage(ctx),
      };
    case "not_ready":
      return {
        context: withState(ctx, "awaiting_not_ready_followup"),
        reply: messages.notReadyMessage(ctx),
      };
    default:
      return null;
  }
}

function handleFitResponse(
  context: DemoConversationContext,
  inboundText: string,
): TransitionResult {
  const signals = getSignals(inboundText);

  if (signals.identityQuestion) {
    return {
      context,
      reply: messages.identityAnswerMessage(context),
    };
  }

  const ctx = withInbound(context, inboundText, cancelFollowUps());
  const ctxSignals = { lastCustomerMessage: context.lastCustomerMessage };

  if (signals.demoError || signals.negativeReaction) {
    if (signals.demoError) {
      return {
        context: withState(ctx, "awaiting_demo_error_detail"),
        reply: messages.demoErrorDetailQuestion(ctx),
      };
    }
    return {
      context: withState(ctx, "awaiting_negative_feedback"),
      reply: messages.negativeWeaknessQuestion(ctx),
    };
  }

  if (signals.explicitMeetingReady) {
    return complete(ctx, messages.shortMeetingReadyMessage(ctx), {
      bookingLinkSent: true,
    });
  }

  if (shouldSendCalendarNow(signals, ctxSignals) || signals.positiveReaction === "strong") {
    return complete(ctx, messages.strongPositiveCalendarMessage(ctx), {
      bookingLinkSent: true,
    });
  }

  if (signals.fitResponse === "no") {
    return {
      context: withState(ctx, "awaiting_objection"),
      reply: messages.objectionQuestion(ctx),
    };
  }

  if (
    signals.fitResponse === "yes" ||
    signals.fitResponse === "probably" ||
    signals.fitResponse === "maybe" ||
    signals.mildPositiveInterest ||
    signals.positiveReaction === "mild" ||
    signals.yes
  ) {
    return {
      context: withState(ctx, "awaiting_workload"),
      reply: messages.workloadQuestion(ctx),
    };
  }

  if (signals.vague) {
    return {
      context: withState(ctx, "awaiting_vague_clarification"),
      reply: messages.vagueClarificationQuestion(ctx),
    };
  }

  if (signals.hasSubstance) {
    return {
      context: withState(ctx, "awaiting_workload"),
      reply: messages.workloadQuestion(ctx),
    };
  }

  return {
    context: withState(ctx, "awaiting_vague_clarification"),
    reply: messages.vagueClarificationQuestion(ctx),
  };
}

function handleObjectionResponse(
  context: DemoConversationContext,
  inboundText: string,
): TransitionResult {
  const ctx = withInbound(context, inboundText);
  const signals = getSignals(inboundText);

  if (signals.notInterested || signals.decline || signals.fitResponse === "no") {
    return complete(ctx, messages.objectionAcknowledgeOnly(ctx), { customerDeclined: true });
  }

  if (shouldSendCalendarNow(signals) || signals.yes || signals.hasSubstance) {
    return complete(ctx, messages.objectionResolvedCalendarMessage(ctx), {
      bookingLinkSent: true,
    });
  }

  return complete(ctx, messages.objectionAcknowledgeOnly(ctx));
}

function migrateLegacyState(state: string): DemoConversationState {
  return "awaiting_fit";
}

function isKnownState(state: string): state is DemoConversationState {
  return [
    "awaiting_fit",
    "awaiting_workload",
    "awaiting_objection",
    "awaiting_negative_feedback",
    "awaiting_demo_error_detail",
    "awaiting_demo_error_useful",
    "awaiting_faq_624voice",
    "awaiting_customization",
    "awaiting_orchestration",
    "awaiting_office_staff_task",
    "awaiting_answering_service_gap",
    "awaiting_already_ai_handling",
    "awaiting_already_ai_gaps",
    "awaiting_not_ready_followup",
    "awaiting_just_testing_followup",
    "awaiting_just_testing_part",
    "awaiting_vague_clarification",
    "completed",
  ].includes(state);
}

export function advanceDemoConversation(
  context: DemoConversationContext,
  inboundText: string,
): TransitionResult {
  const state =
    context.state === "awaiting_demo_feature" || !isKnownState(context.state)
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
    case "awaiting_fit":
      return handleFitResponse(workingContext, inboundText);

    case "awaiting_workload":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.calendarMessage(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_objection":
      return handleObjectionResponse(workingContext, inboundText);

    case "awaiting_negative_feedback":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.negativeFeedbackFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_demo_error_detail":
      return {
        context: withState(
          withInbound(workingContext, inboundText, cancelFollowUps()),
          "awaiting_demo_error_useful",
        ),
        reply: messages.demoErrorUsefulQuestion(workingContext),
      };

    case "awaiting_demo_error_useful": {
      const signals = getSignals(inboundText);
      if (signals.yes || signals.scheduleReady) {
        return complete(
          withInbound(workingContext, inboundText),
          messages.demoErrorUsefulYesFollowUp(workingContext),
          { bookingLinkSent: true },
        );
      }
      return complete(withInbound(workingContext, inboundText), messages.declineMessage(), {
        customerDeclined: true,
      });
    }

    case "awaiting_faq_624voice":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.shortMeetingReadyMessage(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_customization":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.customizationFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_orchestration":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.orchestrationFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_office_staff_task":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.officeStaffFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_answering_service_gap":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.answeringServiceFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_already_ai_handling":
      return {
        context: withState(
          withInbound(workingContext, inboundText, cancelFollowUps()),
          "awaiting_already_ai_gaps",
        ),
        reply: messages.alreadyAiGapsQuestion(workingContext),
      };

    case "awaiting_already_ai_gaps":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.alreadyAiFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_vague_clarification":
      return handleFitResponse(workingContext, inboundText);

    case "awaiting_not_ready_followup":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.notReadyFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "awaiting_just_testing_followup": {
      const signals = getSignals(inboundText);
      if (signals.yes || signals.positiveReaction !== "none" || signals.hasSubstance) {
        return {
          context: withState(
            withInbound(workingContext, inboundText, cancelFollowUps()),
            "awaiting_just_testing_part",
          ),
          reply: messages.justTestingPartQuestion(workingContext),
        };
      }
      return complete(
        withInbound(workingContext, inboundText),
        messages.justTestingNoMessage(withInbound(workingContext, inboundText)),
        { customerDeclined: true },
      );
    }

    case "awaiting_just_testing_part":
      return complete(
        withInbound(workingContext, inboundText, cancelFollowUps()),
        messages.justTestingYesFollowUp(workingContext),
        { bookingLinkSent: true },
      );

    case "completed": {
      const global = handleGlobalIntents(workingContext, inboundText);
      if (global) {
        return global;
      }
      return handleFitResponse(workingContext, inboundText);
    }

    default:
      return handleFitResponse(withState(workingContext, "awaiting_fit"), inboundText);
  }
}
