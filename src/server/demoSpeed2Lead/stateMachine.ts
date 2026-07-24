import {
  classifyDemoIntent,
  classifyInitialFeatureIntent,
  type DemoIntent,
} from "~/server/demoSpeed2Lead/intents";
import * as messages from "~/server/demoSpeed2Lead/messages";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";

export type TransitionResult = {
  context: DemoConversationContext;
  reply: string;
};

const FREE_FORM_ANSWER_STATES = new Set<DemoConversationContext["state"]>([
  "awaiting_faq_after_hours_process",
  "awaiting_faq_inconsistent_where",
  "awaiting_faq_routine_questions",
  "awaiting_booking_after_hours_today",
  "awaiting_booking_scheduling_work",
  "awaiting_booking_friction",
  "awaiting_confirmation_how_confirmed",
  "awaiting_confirmation_manual_tasks",
  "awaiting_confirmation_consistency_where",
  "awaiting_maintenance_plan_consistency",
  "awaiting_maintenance_no_plan_opportunity",
  "awaiting_maintenance_offer_timing",
  "awaiting_maintenance_best_fit",
  "awaiting_multiple_revenue_opportunity",
  "awaiting_multiple_workload_task",
  "awaiting_multiple_both_pressure",
  "awaiting_not_sure_wait_longest",
  "awaiting_not_sure_repetitive_task",
  "awaiting_positive_value",
  "awaiting_negative_weakness",
  "awaiting_demo_error_detail",
  "awaiting_624voice_followup",
  "awaiting_customization_followup",
  "awaiting_orchestration_followup",
  "awaiting_office_staff_task",
  "awaiting_answering_service_gap",
  "awaiting_already_ai_handling",
  "awaiting_already_ai_gaps",
  "awaiting_vague_revenue_opportunity",
  "awaiting_vague_workload_task",
  "awaiting_vague_both_pressure",
  "awaiting_not_ready_followup",
  "awaiting_just_testing_part",
]);

function withState(
  context: DemoConversationContext,
  state: DemoConversationContext["state"],
  extra: Partial<DemoConversationContext> = {},
): DemoConversationContext {
  return {
    ...context,
    ...extra,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function withCustomerMessage(
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

function complete(
  context: DemoConversationContext,
  reply: string,
  extra: Partial<DemoConversationContext> = {},
): TransitionResult {
  const bookingLinkSent =
    extra.bookingLinkSent ?? reply.includes(context.bookingUrl);
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

function cancelFollowUps(context: DemoConversationContext): Partial<DemoConversationContext> {
  return { nextFollowUpAt: undefined };
}

function handleGlobalIntents(
  context: DemoConversationContext,
  intent: DemoIntent,
  inboundText: string,
): TransitionResult | null {
  switch (intent) {
    case "stop":
    case "decline":
      return complete(
        withCustomerMessage(context, inboundText, {
          customerDeclined: true,
          ...cancelFollowUps(context),
        }),
        messages.declineMessage(),
      );
    case "meeting_booked":
      return complete(
        withCustomerMessage(context, inboundText, {
          meetingBooked: true,
          ...cancelFollowUps(context),
        }),
        messages.meetingBookedMessage(context),
      );
    case "ready_to_book":
      return complete(
        withCustomerMessage(context, inboundText, { bookingLinkSent: true }),
        messages.readyToBookMessage(context),
      );
    case "faq_624voice":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_624voice_followup",
          cancelFollowUps(context),
        ),
        reply: messages.faq624VoiceMessage(context),
      };
    case "customization":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_customization_followup",
          cancelFollowUps(context),
        ),
        reply: messages.customizationMessage(context),
      };
    case "orchestration":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_orchestration_followup",
          cancelFollowUps(context),
        ),
        reply: messages.orchestrationMessage(context),
      };
    case "price":
      return complete(
        withCustomerMessage(context, inboundText, { bookingLinkSent: true }),
        messages.priceMessage(context),
      );
    case "office_staff":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_office_staff_task",
          cancelFollowUps(context),
        ),
        reply: messages.officeStaffQuestion(context),
      };
    case "answering_service":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_answering_service_gap",
          cancelFollowUps(context),
        ),
        reply: messages.answeringServiceQuestion(context),
      };
    case "already_uses_ai":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_already_ai_handling",
          cancelFollowUps(context),
        ),
        reply: messages.alreadyAiHandlingQuestion(context),
      };
    case "just_testing":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_just_testing_followup",
          cancelFollowUps(context),
        ),
        reply: messages.justTestingMessage(context),
      };
    case "not_ready":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_not_ready_followup",
          cancelFollowUps(context),
        ),
        reply: messages.notReadyMessage(context),
      };
    case "vague_response":
      return {
        context: withState(
          withCustomerMessage(context, inboundText),
          "awaiting_vague_clarification",
          cancelFollowUps(context),
        ),
        reply: messages.vagueClarificationQuestion(context),
      };
    default:
      return null;
  }
}

function handleInitialFeature(
  context: DemoConversationContext,
  intent: DemoIntent,
  inboundText: string,
): TransitionResult {
  const ctx = withCustomerMessage(context, inboundText, {
    featureThatStoodOut: inboundText.trim(),
    ...cancelFollowUps(context),
  });

  switch (intent) {
    case "feature_faq":
      return {
        context: withState(ctx, "awaiting_faq_business_value"),
        reply: messages.faqBusinessValueQuestion(ctx),
      };
    case "feature_booking":
      return {
        context: withState(ctx, "awaiting_booking_value"),
        reply: messages.bookingValueQuestion(ctx),
      };
    case "feature_confirmation":
      return {
        context: withState(ctx, "awaiting_confirmation_value"),
        reply: messages.confirmationValueQuestion(ctx),
      };
    case "feature_maintenance":
      return {
        context: withState(ctx, "awaiting_maintenance_value"),
        reply: messages.maintenanceValueQuestion(ctx),
      };
    case "feature_multiple":
      return {
        context: withState(ctx, "awaiting_multiple_priority"),
        reply: messages.multiplePriorityQuestion(ctx),
      };
    case "not_sure":
      return {
        context: withState(ctx, "awaiting_not_sure_relevance"),
        reply: messages.notSureRelevanceQuestion(ctx),
      };
    case "positive_feedback":
      return {
        context: withState(ctx, "awaiting_positive_value"),
        reply: messages.positiveValueQuestion(ctx),
      };
    case "negative_feedback":
      return {
        context: withState(ctx, "awaiting_negative_weakness"),
        reply: messages.negativeWeaknessQuestion(ctx),
      };
    case "demo_error":
      return {
        context: withState(ctx, "awaiting_demo_error_detail"),
        reply: messages.demoErrorDetailQuestion(ctx),
      };
    default:
      return {
        context: ctx,
        reply: messages.repromptFeatureQuestion(ctx),
      };
  }
}

function handleFaqBusinessValue(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "after_hours":
      return {
        context: withState(context, "awaiting_faq_after_hours_process"),
        reply: messages.faqAfterHoursProcessQuestion(context),
      };
    case "consistent_information":
      return {
        context: withState(context, "awaiting_faq_inconsistent_where"),
        reply: messages.faqInconsistentWhereQuestion(context),
      };
    case "routine_questions":
      return {
        context: withState(context, "awaiting_faq_routine_questions"),
        reply: messages.faqRoutineQuestionsQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.faqBusinessValueQuestion(context),
      };
  }
}

function handleBookingValue(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "capturing_after_hours":
    case "after_hours":
      return {
        context: withState(context, "awaiting_booking_after_hours_today"),
        reply: messages.bookingAfterHoursTodayQuestion(context),
      };
    case "reducing_scheduling":
      return {
        context: withState(context, "awaiting_booking_scheduling_work"),
        reply: messages.bookingSchedulingWorkQuestion(context),
      };
    case "easier_booking":
      return {
        context: withState(context, "awaiting_booking_friction"),
        reply: messages.bookingFrictionQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.bookingValueQuestion(context),
      };
  }
}

function handleConfirmationValue(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "fewer_missed":
      return {
        context: withState(context, "awaiting_confirmation_how_confirmed"),
        reply: messages.confirmationHowConfirmedQuestion(context),
      };
    case "less_manual":
      return {
        context: withState(context, "awaiting_confirmation_manual_tasks"),
        reply: messages.confirmationManualTasksQuestion(context),
      };
    case "professional_experience":
      return {
        context: withState(context, "awaiting_confirmation_consistency_where"),
        reply: messages.confirmationConsistencyWhereQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.confirmationValueQuestion(context),
      };
  }
}

function handleMaintenanceValue(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "recurring_revenue":
      return {
        context: withState(context, "awaiting_maintenance_has_plan"),
        reply: messages.maintenanceHasPlanQuestion(context),
      };
    case "offer_consistently":
      return {
        context: withState(context, "awaiting_maintenance_offer_timing"),
        reply: messages.maintenanceOfferTimingQuestion(context),
      };
    case "reaching_customers":
      return {
        context: withState(context, "awaiting_maintenance_best_fit"),
        reply: messages.maintenanceBestFitQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.maintenanceValueQuestion(context),
      };
  }
}

function handleMultiplePriority(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "capturing_revenue":
      return {
        context: withState(context, "awaiting_multiple_revenue_opportunity"),
        reply: messages.multipleRevenueOpportunityQuestion(context),
      };
    case "reducing_workload":
      return {
        context: withState(context, "awaiting_multiple_workload_task"),
        reply: messages.multipleWorkloadTaskQuestion(context),
      };
    case "both":
      return {
        context: withState(context, "awaiting_multiple_both_pressure"),
        reply: messages.multipleBothPressureQuestion(context),
      };
    default:
      return {
        context,
        reply: messages.multiplePriorityQuestion(context),
      };
  }
}

function handleNotSureRelevance(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "immediate_response":
      return {
        context: withState(context, "awaiting_not_sure_wait_longest"),
        reply: messages.notSureWaitLongestQuestion(context),
      };
    case "taking_work_off":
    case "reducing_workload":
      return {
        context: withState(context, "awaiting_not_sure_repetitive_task"),
        reply: messages.notSureRepetitiveTaskQuestion(context),
      };
    case "not_sure":
    case "detail":
      return complete(context, messages.notSureFallbackFollowUp(context));
    default:
      return {
        context,
        reply: messages.notSureRelevanceQuestion(context),
      };
  }
}

function handleVagueClarification(
  context: DemoConversationContext,
  intent: DemoIntent,
): TransitionResult {
  switch (intent) {
    case "capturing_revenue":
      return {
        context: withState(context, "awaiting_vague_revenue_opportunity"),
        reply: messages.vagueRevenueOpportunityQuestion(context),
      };
    case "reducing_workload":
      return {
        context: withState(context, "awaiting_vague_workload_task"),
        reply: messages.vagueWorkloadTaskQuestion(context),
      };
    case "both":
      return {
        context: withState(context, "awaiting_vague_both_pressure"),
        reply: messages.vagueBothPressureQuestion(context),
      };
    default:
      if (intent === "not_sure" || intent === "detail" || intent === "vague_response") {
        return complete(context, messages.vagueFallbackFollowUp(context));
      }
      return {
        context,
        reply: messages.vagueClarificationQuestion(context),
      };
  }
}

export function advanceDemoConversation(
  context: DemoConversationContext,
  inboundText: string,
): TransitionResult {
  const intent = classifyDemoIntent(inboundText, context.state);
  const ctx = withCustomerMessage(context, inboundText, cancelFollowUps(context));

  if (!FREE_FORM_ANSWER_STATES.has(context.state)) {
    const global = handleGlobalIntents(ctx, intent, inboundText);
    if (global) {
      return global;
    }
  }

  switch (context.state) {
    case "awaiting_demo_feature":
      return handleInitialFeature(
        ctx,
        classifyInitialFeatureIntent(inboundText),
        inboundText,
      );

    case "awaiting_faq_business_value":
      return handleFaqBusinessValue(ctx, intent);

    case "awaiting_faq_after_hours_process":
      return complete(ctx, messages.faqAfterHoursFollowUp(ctx));

    case "awaiting_faq_inconsistent_where":
      return complete(ctx, messages.faqInconsistentFollowUp(ctx));

    case "awaiting_faq_routine_questions":
      return complete(ctx, messages.faqRoutineQuestionsFollowUp(ctx));

    case "awaiting_booking_value":
      return handleBookingValue(ctx, intent);

    case "awaiting_booking_after_hours_today":
      return complete(ctx, messages.bookingAfterHoursFollowUp(ctx));

    case "awaiting_booking_scheduling_work":
      return complete(ctx, messages.bookingSchedulingWorkFollowUp(ctx));

    case "awaiting_booking_friction":
      return complete(ctx, messages.bookingFrictionFollowUp(ctx));

    case "awaiting_confirmation_value":
      return handleConfirmationValue(ctx, intent);

    case "awaiting_confirmation_how_confirmed":
      return complete(ctx, messages.confirmationFewerMissedFollowUp(ctx));

    case "awaiting_confirmation_manual_tasks":
      return complete(ctx, messages.confirmationManualFollowUp(ctx));

    case "awaiting_confirmation_consistency_where":
      return complete(ctx, messages.confirmationProfessionalFollowUp(ctx));

    case "awaiting_maintenance_value":
      return handleMaintenanceValue(ctx, intent);

    case "awaiting_maintenance_has_plan":
      if (intent === "yes") {
        return {
          context: withState(ctx, "awaiting_maintenance_plan_consistency"),
          reply: messages.maintenancePlanConsistencyQuestion(ctx),
        };
      }
      if (intent === "no") {
        return {
          context: withState(ctx, "awaiting_maintenance_no_plan_opportunity"),
          reply: messages.maintenanceNoPlanOpportunityQuestion(ctx),
        };
      }
      return {
        context: ctx,
        reply: messages.maintenanceHasPlanQuestion(ctx),
      };

    case "awaiting_maintenance_plan_consistency":
      return complete(ctx, messages.maintenanceHasPlanFollowUp(ctx));

    case "awaiting_maintenance_no_plan_opportunity":
      return complete(ctx, messages.maintenanceNoPlanFollowUp(ctx));

    case "awaiting_maintenance_offer_timing":
      return complete(ctx, messages.maintenanceOfferTimingFollowUp(ctx));

    case "awaiting_maintenance_best_fit":
      return complete(ctx, messages.maintenanceReachFollowUp(ctx));

    case "awaiting_multiple_priority":
      return handleMultiplePriority(ctx, intent);

    case "awaiting_multiple_revenue_opportunity":
      return complete(ctx, messages.multipleRevenueFollowUp(ctx));

    case "awaiting_multiple_workload_task":
      return complete(ctx, messages.multipleWorkloadFollowUp(ctx));

    case "awaiting_multiple_both_pressure":
      return complete(ctx, messages.multipleBothFollowUp(ctx));

    case "awaiting_not_sure_relevance":
      return handleNotSureRelevance(ctx, intent);

    case "awaiting_not_sure_wait_longest":
      return complete(ctx, messages.notSureImmediateFollowUp(ctx));

    case "awaiting_not_sure_repetitive_task":
      return complete(ctx, messages.notSureWorkloadFollowUp(ctx));

    case "awaiting_positive_value":
      return complete(ctx, messages.positiveFeedbackFollowUp(ctx));

    case "awaiting_negative_weakness":
      return complete(ctx, messages.negativeFeedbackFollowUp(ctx));

    case "awaiting_demo_error_detail":
      return {
        context: withState(ctx, "awaiting_demo_error_useful"),
        reply: messages.demoErrorUsefulQuestion(ctx),
      };

    case "awaiting_demo_error_useful":
      if (intent === "yes" || intent === "vague_response") {
        return complete(ctx, messages.demoErrorUsefulYesFollowUp(ctx));
      }
      return complete(ctx, messages.declineMessage(), { customerDeclined: true });

    case "awaiting_624voice_followup":
      return complete(ctx, messages.faq624VoiceFollowUp(ctx));

    case "awaiting_customization_followup":
      return complete(ctx, messages.customizationFollowUp(ctx));

    case "awaiting_orchestration_followup":
      return complete(ctx, messages.orchestrationFollowUp(ctx));

    case "awaiting_office_staff_task":
      return complete(ctx, messages.officeStaffFollowUp(ctx));

    case "awaiting_answering_service_gap":
      return complete(ctx, messages.answeringServiceFollowUp(ctx));

    case "awaiting_already_ai_handling":
      return {
        context: withState(ctx, "awaiting_already_ai_gaps"),
        reply: messages.alreadyAiGapsQuestion(ctx),
      };

    case "awaiting_already_ai_gaps":
      return complete(ctx, messages.alreadyAiFollowUp(ctx));

    case "awaiting_vague_clarification":
      return handleVagueClarification(ctx, intent);

    case "awaiting_vague_revenue_opportunity":
      return complete(ctx, messages.vagueRevenueFollowUp(ctx));

    case "awaiting_vague_workload_task":
      return complete(ctx, messages.vagueWorkloadFollowUp(ctx));

    case "awaiting_vague_both_pressure":
      return complete(ctx, messages.vagueBothFollowUp(ctx));

    case "awaiting_not_ready_followup":
      return complete(ctx, messages.notReadyFollowUp(ctx));

    case "awaiting_just_testing_followup":
      if (intent === "yes" || intent === "vague_response" || intent === "positive_feedback") {
        return {
          context: withState(ctx, "awaiting_just_testing_part"),
          reply: messages.justTestingPartQuestion(ctx),
        };
      }
      return complete(ctx, messages.justTestingNoMessage(), { customerDeclined: true });

    case "awaiting_just_testing_part":
      return complete(ctx, messages.justTestingYesFollowUp(ctx));

    case "completed":
      if (intent === "meeting_booked") {
        return complete(ctx, messages.meetingBookedMessage(ctx), { meetingBooked: true });
      }
      if (intent === "ready_to_book" || intent === "price") {
        return complete(ctx, messages.readyToBookMessage(ctx), { bookingLinkSent: true });
      }
      return handleInitialFeature(ctx, classifyInitialFeatureIntent(inboundText), inboundText);

    default:
      return {
        context: withState(ctx, "awaiting_demo_feature"),
        reply: messages.initialMessage(ctx),
      };
  }
}
