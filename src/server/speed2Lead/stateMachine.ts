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
  "awaiting_answering_service_gap",
  "awaiting_office_staff_task",
]);

const GOAL_INTENTS = new Set<Intent>([
  "goal_booking_jobs",
  "goal_growing_staff",
  "goal_both",
  "goal_not_sure",
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

function handleGlobalIntents(
  context: ConversationContext,
  intent: Intent,
): TransitionResult | null {
  switch (intent) {
    case "stop":
    case "decline":
      return {
        context: withState(context, "completed"),
        reply: messages.declineMessage(),
      };
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
      return {
        context: withState(context, "completed"),
        reply: messages.scheduleYesMessage(context),
      };
    case "vague_yes":
      return {
        context: withState(context, "awaiting_vague_clarification"),
        reply: messages.vagueClarificationMessage(context),
      };
    case "price":
      return {
        context: withState(context, "completed"),
        reply: messages.priceMessage(context),
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

function handleLegacyBothRevenueDetail(
  context: ConversationContext,
): TransitionResult {
  return {
    context: withState(context, "completed"),
    reply: messages.bothRevenueFollowUp(context),
  };
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
      return handleGoalFollowUp(context, intent, messages.vagueClarificationMessage);

    case "awaiting_booking_subgoal":
      return handleBookingSubgoal(context, intent);

    case "awaiting_both_revenue_subgoal":
      return handleBookingSubgoal(context, intent);

    case "awaiting_both_revenue_detail":
      return handleLegacyBothRevenueDetail(context);

    case "awaiting_booking_calls_window":
      return {
        context: withState(context, "completed"),
        reply: messages.bookingCallsWindowFollowUp(context),
      };

    case "awaiting_booking_response_speed":
      return {
        context: withState(context, "completed"),
        reply: messages.bookingResponseSpeedFollowUp(context),
      };

    case "awaiting_booking_followup_process":
      return {
        context: withState(context, "completed"),
        reply: messages.bookingFollowUpFollowUp(context),
      };

    case "awaiting_staff_pressure":
      return {
        context: withState(context, "awaiting_staff_time_estimate"),
        reply: messages.staffTimeQuestion(context),
      };

    case "awaiting_staff_time_estimate":
      return {
        context: withState(context, "completed"),
        reply:
          context.track === "both_time"
            ? messages.bothTimeFollowUp(context)
            : messages.staffTimeFollowUp(context),
      };

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
          context: withState({ ...context, track: "both_time" }, "awaiting_both_time_task"),
          reply: messages.bothTimeTaskQuestion(context),
        };
      }
      return {
        context,
        reply: messages.bothPriorityQuestion(context),
      };

    case "awaiting_both_time_task":
      return {
        context: withState(context, "awaiting_staff_time_estimate"),
        reply: messages.staffTimeQuestion(context),
      };

    case "awaiting_not_sure_frustration":
      return {
        context: withState(context, "completed"),
        reply: messages.notSureFollowUp(context),
      };

    case "awaiting_report_assumptions":
      if (intent === "yes") {
        return {
          context: withState(context, "completed"),
          reply: messages.notReadySummaryMessage(context),
        };
      }
      return {
        context: withState(context, "completed"),
        reply: messages.scheduleYesMessage(context),
      };

    case "awaiting_not_ready_summary":
      if (intent === "yes" || intent === "vague_yes") {
        return {
          context: withState(context, "completed"),
          reply: messages.notReadySummaryMessage(context),
        };
      }
      return {
        context: withState(context, "completed"),
        reply: messages.declineMessage(),
      };

    case "awaiting_answering_service_gap":
      return {
        context: withState(context, "completed"),
        reply: messages.answeringServiceFollowUp(context),
      };

    case "awaiting_office_staff_task":
      return {
        context: withState(context, "completed"),
        reply: messages.officeStaffFollowUp(context),
      };

    case "completed":
      return handleGoalSelection(context, intent);

    default:
      return {
        context: withState(context, "awaiting_goal"),
        reply: messages.initialMessage(context),
      };
  }
}
