import { restateCustomerGoal } from "~/server/contactSpeed2Lead/needSummary";
import {
  classifyContactIntent,
  type ContactIntent,
} from "~/server/contactSpeed2Lead/intents";
import * as messages from "~/server/contactSpeed2Lead/messages";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";

type TransitionResult = {
  context: ContactConversationContext;
  reply: string;
};

const FREE_FORM_ANSWER_STATES = new Set<ContactConversationContext["state"]>([
  "awaiting_contact_booking_calls_window",
  "awaiting_contact_booking_response_speed",
  "awaiting_contact_booking_followup_process",
  "awaiting_contact_staff_time",
  "awaiting_contact_calls_fewer_missed",
  "awaiting_contact_calls_after_hours",
  "awaiting_contact_calls_consistent_answers",
  "awaiting_contact_calls_easier_scheduling",
  "awaiting_contact_both_revenue_slippage",
  "awaiting_contact_both_time_task",
  "awaiting_contact_something_else",
  "awaiting_contact_faq_voice",
  "awaiting_contact_faq_website",
  "awaiting_contact_answering_service_gap",
  "awaiting_contact_office_staff_task",
  "awaiting_contact_vague_staff_task",
  "awaiting_contact_vague_calls_improvement",
]);

const SUBGOAL_INTENTS = new Set<ContactIntent>([
  "subgoal_answering_calls",
  "subgoal_responding_faster",
  "subgoal_follow_up",
]);

const CALL_IMPROVEMENT_INTENTS = new Set<ContactIntent>([
  "call_fewer_missed",
  "call_after_hours",
  "call_consistent_answers",
  "call_easier_scheduling",
]);

function withState(
  context: ContactConversationContext,
  state: ContactConversationContext["state"],
): ContactConversationContext {
  return {
    ...context,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function complete(context: ContactConversationContext, reply: string): TransitionResult {
  return {
    context: withState(context, "completed"),
    reply,
  };
}

function handleGlobalIntents(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult | null {
  switch (intent) {
    case "stop":
    case "decline":
      return complete(context, messages.declineMessage());
    case "faq":
      return {
        context: withState(context, "awaiting_contact_faq_followup"),
        reply: messages.faqMessage(context),
      };
    case "request_information":
      return {
        context: withState(context, "awaiting_contact_info_followup"),
        reply: messages.requestInfoMessage(context),
      };
    case "not_ready":
      return {
        context: withState(context, "awaiting_contact_not_ready_followup"),
        reply: messages.notReadyMessage(context),
      };
    case "schedule_yes":
      return complete(context, messages.scheduleYesMessage(context));
    case "vague_yes":
      return {
        context: withState(context, "awaiting_contact_vague_clarification"),
        reply: messages.vagueClarificationMessage(context),
      };
    case "price":
      return complete(context, messages.priceMessage(context));
    case "answering_service":
      return {
        context: withState(context, "awaiting_contact_answering_service_gap"),
        reply: messages.answeringServiceQuestion(context),
      };
    case "office_staff":
      return {
        context: withState(context, "awaiting_contact_office_staff_task"),
        reply: messages.officeStaffQuestion(context),
      };
    default:
      return null;
  }
}

function handleContactGoal(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult {
  switch (intent) {
    case "goal_booking_jobs":
      return {
        context: withState(context, "awaiting_contact_booking_subgoal"),
        reply: messages.bookingSubgoalMessage(context),
      };
    case "goal_growing_staff":
      return {
        context: withState(context, "awaiting_contact_staff_task"),
        reply: messages.staffTaskQuestion(context),
      };
    case "goal_improving_calls":
      return {
        context: withState(context, "awaiting_contact_calls_improvement"),
        reply: messages.callsImprovementQuestion(context),
      };
    case "goal_both":
      return {
        context: withState(context, "awaiting_contact_both_priority"),
        reply: messages.bothPriorityQuestion(context),
      };
    case "goal_something_else":
      return {
        context: withState(context, "awaiting_contact_something_else"),
        reply: messages.somethingElseQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.initialMessage(context),
      };
  }
}

function handleBookingSubgoal(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult {
  switch (intent) {
    case "subgoal_answering_calls":
      return {
        context: withState(context, "awaiting_contact_booking_calls_window"),
        reply: messages.bookingCallsWindowMessage(context),
      };
    case "subgoal_responding_faster":
      return {
        context: withState(context, "awaiting_contact_booking_response_speed"),
        reply: messages.bookingResponseSpeedQuestion(context),
      };
    case "subgoal_follow_up":
      return {
        context: withState(context, "awaiting_contact_booking_followup_process"),
        reply: messages.bookingFollowUpQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.bookingSubgoalMessage(context),
      };
  }
}

function handleCallsImprovement(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult {
  switch (intent) {
    case "call_fewer_missed":
      return {
        context: withState(context, "awaiting_contact_calls_fewer_missed"),
        reply: messages.callsFewerMissedQuestion(context),
      };
    case "call_after_hours":
      return {
        context: withState(context, "awaiting_contact_calls_after_hours"),
        reply: messages.callsAfterHoursQuestion(context),
      };
    case "call_consistent_answers":
      return {
        context: withState(context, "awaiting_contact_calls_consistent_answers"),
        reply: messages.callsConsistentAnswersQuestion(context),
      };
    case "call_easier_scheduling":
      return {
        context: withState(context, "awaiting_contact_calls_easier_scheduling"),
        reply: messages.callsEasierSchedulingQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.callsImprovementQuestion(context),
      };
  }
}

function handleBothPriority(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult {
  if (
    intent === "subgoal_booking_revenue" ||
    intent === "goal_booking_jobs"
  ) {
    return {
      context: withState(context, "awaiting_contact_both_revenue_slippage"),
      reply: messages.bothRevenueSlippageQuestion(context),
    };
  }

  if (
    intent === "subgoal_freeing_time" ||
    intent === "goal_growing_staff"
  ) {
    return {
      context: withState(context, "awaiting_contact_both_time_task"),
      reply: messages.bothTimeTaskQuestion(context),
    };
  }

  return {
    context,
    reply: messages.bothPriorityQuestion(context),
  };
}

function handleVagueClarification(
  context: ContactConversationContext,
  intent: ContactIntent,
): TransitionResult {
  switch (intent) {
    case "goal_booking_jobs":
      return {
        context: withState(context, "awaiting_contact_vague_booking_subgoal"),
        reply: messages.vagueBookingSubgoalMessage(context),
      };
    case "goal_growing_staff":
      return {
        context: withState(context, "awaiting_contact_vague_staff_task"),
        reply: messages.vagueStaffTaskQuestion(context),
      };
    case "goal_improving_calls":
      return {
        context: withState(context, "awaiting_contact_vague_calls_improvement"),
        reply: messages.vagueCallsImprovementQuestion(context),
      };
    case "goal_both":
      return {
        context: withState(context, "awaiting_contact_both_priority"),
        reply: messages.bothPriorityQuestion(context),
      };
    default:
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
}

export function advanceContactConversation(
  context: ContactConversationContext,
  inboundText: string,
): TransitionResult {
  const intent = classifyContactIntent(inboundText, context.state);

  if (!FREE_FORM_ANSWER_STATES.has(context.state)) {
    const global = handleGlobalIntents(context, intent);
    if (global) {
      return global;
    }
  }

  switch (context.state) {
    case "awaiting_contact_goal":
      return handleContactGoal(context, intent);

    case "awaiting_contact_booking_subgoal":
      return handleBookingSubgoal(context, intent);

    case "awaiting_contact_booking_calls_window":
      return complete(context, messages.bookingCallsWindowFollowUp(context));

    case "awaiting_contact_booking_response_speed":
      return complete(context, messages.bookingResponseSpeedFollowUp(context));

    case "awaiting_contact_booking_followup_process":
      return complete(context, messages.bookingFollowUpFollowUp(context));

    case "awaiting_contact_staff_task":
      return {
        context: withState(context, "awaiting_contact_staff_time"),
        reply: messages.staffTimeQuestion(context),
      };

    case "awaiting_contact_staff_time":
      return complete(context, messages.staffTimeFollowUp(context));

    case "awaiting_contact_calls_improvement":
      return handleCallsImprovement(context, intent);

    case "awaiting_contact_calls_fewer_missed":
      return complete(context, messages.callsFewerMissedFollowUp(context));

    case "awaiting_contact_calls_after_hours":
      return complete(context, messages.callsAfterHoursFollowUp(context));

    case "awaiting_contact_calls_consistent_answers":
      return complete(context, messages.callsConsistentAnswersFollowUp(context));

    case "awaiting_contact_calls_easier_scheduling":
      return complete(context, messages.callsEasierSchedulingFollowUp(context));

    case "awaiting_contact_both_priority":
      return handleBothPriority(context, intent);

    case "awaiting_contact_both_revenue_slippage":
      return complete(context, messages.bothRevenueFollowUp(context));

    case "awaiting_contact_both_time_task":
      return complete(context, messages.bothTimeFollowUp(context));

    case "awaiting_contact_something_else":
      return complete(context, messages.somethingElseFollowUp({
        ...context,
        lastCustomerMessage: restateCustomerGoal(inboundText),
      }));

    case "awaiting_contact_faq_followup":
      if (intent === "faq_voice_ai") {
        return {
          context: withState(context, "awaiting_contact_faq_voice"),
          reply: messages.faqVoiceQuestion(context),
        };
      }
      if (intent === "faq_website") {
        return {
          context: withState(context, "awaiting_contact_faq_website"),
          reply: messages.faqWebsiteQuestion(context),
        };
      }
      return {
        context,
        reply: messages.faqMessage(context),
      };

    case "awaiting_contact_faq_voice":
      return complete(context, messages.faqVoiceFollowUp(context));

    case "awaiting_contact_faq_website":
      return complete(context, messages.faqWebsiteFollowUp(context));

    case "awaiting_contact_info_followup":
      if (intent === "yes" || intent === "vague_yes") {
        return complete(context, messages.requestInfoFollowUp(context));
      }
      return complete(context, messages.declineMessage());

    case "awaiting_contact_not_ready_followup":
      if (intent === "yes" || intent === "vague_yes") {
        return complete(context, messages.notReadyFollowUp(context));
      }
      return complete(context, messages.declineMessage());

    case "awaiting_contact_vague_clarification":
      return handleVagueClarification(context, intent);

    case "awaiting_contact_vague_booking_subgoal":
      if (SUBGOAL_INTENTS.has(intent)) {
        return complete(context, messages.vagueBookingFollowUp(context));
      }
      return {
        context,
        reply: messages.vagueBookingSubgoalMessage(context),
      };

    case "awaiting_contact_vague_staff_task":
      return complete(context, messages.vagueStaffFollowUp(context));

    case "awaiting_contact_vague_calls_improvement":
      if (CALL_IMPROVEMENT_INTENTS.has(intent)) {
        return complete(context, messages.vagueCallsFollowUp(context));
      }
      return complete(context, messages.vagueCallsFollowUp(context));

    case "awaiting_contact_answering_service_gap":
      return complete(context, messages.answeringServiceFollowUp(context));

    case "awaiting_contact_office_staff_task":
      return complete(context, messages.officeStaffFollowUp(context));

    case "completed":
      return handleContactGoal(context, intent);

    default:
      return {
        context: withState(context, "awaiting_contact_goal"),
        reply: messages.initialMessage(context),
      };
  }
}
