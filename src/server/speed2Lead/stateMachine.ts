import { classifyIntent, type Intent } from "~/server/speed2Lead/intents";
import * as messages from "~/server/speed2Lead/messages";
import type { ConversationContext, ConversationState } from "~/server/speed2Lead/types";

type TransitionResult = {
  context: ConversationContext;
  reply: string;
};

const FREE_FORM_ANSWER_STATES = new Set<ConversationState>([
  "awaiting_booking_calls_window",
  "awaiting_booking_response_speed",
  "awaiting_booking_followup_process",
  "awaiting_staff_pressure",
  "awaiting_staff_time_estimate",
  "awaiting_both_revenue_detail",
  "awaiting_both_time_task",
  "awaiting_not_sure_frustration",
  "awaiting_vague_staff_task",
  "awaiting_vague_both_revenue_slippage",
  "awaiting_vague_both_time_task",
  "awaiting_answering_service_gap",
  "awaiting_office_staff_task",
]);

const GOAL_INTENTS = new Set<Intent>([
  "goal_booking_jobs",
  "goal_growing_staff",
  "goal_both",
  "goal_not_sure",
]);

const SUBGOAL_INTENTS = new Set<Intent>([
  "subgoal_answering_calls",
  "subgoal_responding_faster",
  "subgoal_follow_up",
]);

function withState(
  context: ConversationContext,
  state: ConversationState,
): ConversationContext {
  return {
    ...context,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function complete(context: ConversationContext, reply: string): TransitionResult {
  return {
    context: withState(context, "completed"),
    reply,
  };
}

function handleGlobalIntents(
  context: ConversationContext,
  intent: Intent,
): TransitionResult | null {
  switch (intent) {
    case "stop":
    case "decline":
      return complete(context, messages.declineMessage());
    case "faq":
      return {
        context: withState(context, "awaiting_faq_followup"),
        reply: messages.faqMessage(context),
      };
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
    case "schedule_yes":
      return complete(context, messages.scheduleYesMessage(context));
    case "vague_yes":
      return {
        context: withState(context, "awaiting_vague_clarification"),
        reply: messages.vagueClarificationMessage(context),
      };
    case "price":
      return complete(context, messages.priceMessage(context));
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

function handleGoalSelection(
  context: ConversationContext,
  intent: Intent,
): TransitionResult {
  switch (intent) {
    case "goal_booking_jobs":
      return {
        context: withState(context, "awaiting_booking_subgoal"),
        reply: messages.bookingSubgoalMessage(context),
      };
    case "goal_growing_staff":
      return {
        context: withState({ ...context, track: "staff" }, "awaiting_staff_pressure"),
        reply: messages.staffPressureQuestion(context),
      };
    case "goal_both":
      return {
        context: withState(context, "awaiting_both_priority"),
        reply: messages.bothPriorityQuestion(context),
      };
    case "goal_not_sure":
      return {
        context: withState(context, "awaiting_not_sure_frustration"),
        reply: messages.notSureQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.initialMessage(context),
      };
  }
}

function handleGoalFollowUp(
  context: ConversationContext,
  intent: Intent,
  fallback: (context: ConversationContext) => string,
): TransitionResult {
  if (GOAL_INTENTS.has(intent)) {
    return handleGoalSelection(context, intent);
  }

  return {
    context,
    reply: fallback(context),
  };
}

function handleVagueFallback(context: ConversationContext, intent: Intent): TransitionResult {
  if (
    intent === "goal_not_sure" ||
    intent === "vague_yes" ||
    intent === "detail"
  ) {
    return complete(context, messages.vagueFallbackFollowUp(context));
  }

  return {
    context,
    reply: messages.vagueClarificationMessage(context),
  };
}

function handleBookingSubgoal(
  context: ConversationContext,
  intent: Intent,
): TransitionResult {
  switch (intent) {
    case "subgoal_answering_calls":
      return {
        context: withState(context, "awaiting_booking_calls_window"),
        reply: messages.bookingCallsWindowMessage(context),
      };
    case "subgoal_responding_faster":
      return {
        context: withState(context, "awaiting_booking_response_speed"),
        reply: messages.bookingResponseSpeedQuestion(context),
      };
    case "subgoal_follow_up":
      return {
        context: withState(context, "awaiting_booking_followup_process"),
        reply: messages.bookingFollowUpQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.bookingSubgoalMessage(context),
      };
  }
}

function handleBothRevenueSubgoal(
  context: ConversationContext,
  intent: Intent,
): TransitionResult {
  if (SUBGOAL_INTENTS.has(intent)) {
    return complete(context, messages.bothRevenueFollowUp(context));
  }

  return {
    context,
    reply: messages.bothRevenueSubgoalQuestion(context),
  };
}

function handleVagueClarification(
  context: ConversationContext,
  intent: Intent,
): TransitionResult {
  switch (intent) {
    case "goal_booking_jobs":
      return {
        context: withState(context, "awaiting_vague_booking_subgoal"),
        reply: messages.bookingSubgoalMessage(context),
      };
    case "goal_growing_staff":
      return {
        context: withState(context, "awaiting_vague_staff_task"),
        reply: messages.vagueStaffTaskQuestion(context),
      };
    case "goal_both":
      return {
        context: withState(context, "awaiting_vague_both_priority"),
        reply: messages.vagueBothPriorityQuestion(context),
      };
    default:
      return handleVagueFallback(context, intent);
  }
}

function handleVagueBothPriority(
  context: ConversationContext,
  intent: Intent,
): TransitionResult {
  if (
    intent === "subgoal_booking_revenue" ||
    intent === "goal_booking_jobs"
  ) {
    return {
      context: withState(context, "awaiting_vague_both_revenue_slippage"),
      reply: messages.vagueBothRevenueSlippageQuestion(context),
    };
  }

  if (
    intent === "subgoal_freeing_time" ||
    intent === "goal_growing_staff"
  ) {
    return {
      context: withState(context, "awaiting_vague_both_time_task"),
      reply: messages.vagueBothTimeTaskQuestion(context),
    };
  }

  if (intent === "goal_both") {
    return {
      context,
      reply: messages.vagueBothPriorityQuestion(context),
    };
  }

  return handleVagueFallback(context, intent);
}

export function advanceConversation(
  context: ConversationContext,
  inboundText: string,
): TransitionResult {
  const intent = classifyIntent(inboundText, context.state);

  if (!FREE_FORM_ANSWER_STATES.has(context.state)) {
    const global = handleGlobalIntents(context, intent);
    if (global) {
      return global;
    }
  }

  switch (context.state) {
    case "awaiting_goal":
      return handleGoalSelection(context, intent);

    case "awaiting_faq_followup":
      return handleGoalFollowUp(context, intent, messages.faqMessage);

    case "awaiting_vague_clarification":
      return handleVagueClarification(context, intent);

    case "awaiting_vague_booking_subgoal":
      if (SUBGOAL_INTENTS.has(intent)) {
        return complete(context, messages.vagueBookingFollowUp(context));
      }
      return {
        context,
        reply: messages.bookingSubgoalMessage(context),
      };

    case "awaiting_vague_staff_task":
      return complete(context, messages.vagueStaffFollowUp(context));

    case "awaiting_vague_both_priority":
      return handleVagueBothPriority(context, intent);

    case "awaiting_vague_both_revenue_slippage":
      return complete(context, messages.vagueBothRevenueFollowUp(context));

    case "awaiting_vague_both_time_task":
      return complete(context, messages.vagueBothTimeFollowUp(context));

    case "awaiting_booking_subgoal":
      return handleBookingSubgoal(context, intent);

    case "awaiting_both_revenue_subgoal":
      return handleBothRevenueSubgoal(context, intent);

    case "awaiting_both_revenue_detail":
      return complete(context, messages.bothRevenueFollowUp(context));

    case "awaiting_booking_calls_window":
      return complete(context, messages.bookingCallsWindowFollowUp(context));

    case "awaiting_booking_response_speed":
      return complete(context, messages.bookingResponseSpeedFollowUp(context));

    case "awaiting_booking_followup_process":
      return complete(context, messages.bookingFollowUpFollowUp(context));

    case "awaiting_staff_pressure":
      return {
        context: withState(context, "awaiting_staff_time_estimate"),
        reply: messages.staffTimeQuestion(context),
      };

    case "awaiting_staff_time_estimate":
      return complete(context, messages.staffTimeFollowUp(context));

    case "awaiting_both_priority":
      if (
        intent === "subgoal_booking_revenue" ||
        intent === "goal_booking_jobs"
      ) {
        return {
          context: withState(context, "awaiting_both_revenue_subgoal"),
          reply: messages.bothRevenueSubgoalQuestion(context),
        };
      }
      if (
        intent === "subgoal_freeing_time" ||
        intent === "goal_growing_staff"
      ) {
        return {
          context: withState(context, "awaiting_both_time_task"),
          reply: messages.bothTimeTaskQuestion(context),
        };
      }
      return {
        context,
        reply: messages.bothPriorityQuestion(context),
      };

    case "awaiting_both_time_task":
      return complete(context, messages.bothTimeFollowUp(context));

    case "awaiting_not_sure_frustration":
      return complete(context, messages.notSureFollowUp(context));

    case "awaiting_report_assumptions":
      if (intent === "yes") {
        return complete(context, messages.notReadySummaryMessage(context));
      }
      return complete(context, messages.scheduleYesMessage(context));

    case "awaiting_not_ready_summary":
      if (intent === "yes" || intent === "vague_yes") {
        return complete(context, messages.notReadySummaryMessage(context));
      }
      return complete(context, messages.declineMessage());

    case "awaiting_answering_service_gap":
      return complete(context, messages.answeringServiceFollowUp(context));

    case "awaiting_office_staff_task":
      return complete(context, messages.officeStaffFollowUp(context));

    case "completed":
      return handleGoalSelection(context, intent);

    default:
      return {
        context: withState(context, "awaiting_goal"),
        reply: messages.initialMessage(context),
      };
  }
}
