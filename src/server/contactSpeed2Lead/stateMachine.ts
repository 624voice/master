import { classifyGlobalIntent, getSignals } from "~/server/speed2Lead/globalIntents";
import {
  shouldSendCalendarNow,
  type PainCategory,
} from "~/server/speed2Lead/naturalLanguage";
import * as messages from "~/server/contactSpeed2Lead/messages";
import type {
  ContactConversationContext,
  ContactConversationState,
  ContactFollowUpKind,
} from "~/server/contactSpeed2Lead/types";

type TransitionResult = {
  context: ContactConversationContext;
  reply: string;
};

const FREE_FORM_STATES = new Set<ContactConversationState>([
  "awaiting_follow_up",
  "awaiting_info_area",
  "awaiting_answering_service_gap",
  "awaiting_office_staff_task",
]);

function withState(
  context: ContactConversationContext,
  state: ContactConversationState,
  extra: Partial<ContactConversationContext> = {},
): ContactConversationContext {
  return {
    ...context,
    ...extra,
    state,
    updatedAt: new Date().toISOString(),
  };
}

function withInbound(
  context: ContactConversationContext,
  inboundText: string,
  extra: Partial<ContactConversationContext> = {},
): ContactConversationContext {
  return {
    ...context,
    ...extra,
    lastCustomerMessage: inboundText.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function complete(
  context: ContactConversationContext,
  reply: string,
  extra: Partial<ContactConversationContext> = {},
): TransitionResult {
  return {
    context: withState(context, "completed", extra),
    reply,
  };
}

function chooseFollowUpKind(pains: PainCategory[], text: string): ContactFollowUpKind {
  if (pains.includes("website")) {
    return "website";
  }
  if (
    pains.includes("missed_calls") ||
    pains.includes("after_hours") ||
    includesAfterHoursNeed(text)
  ) {
    return "missed_calls";
  }
  return "general";
}

function includesAfterHoursNeed(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("after hours") || lower.includes("after 5") || lower.includes("phones");
}

function handleGlobalIntents(
  context: ContactConversationContext,
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
      return {
        context: withState(context, "awaiting_faq_followup"),
        reply: messages.faqMessage(context),
      };
    case "request_information":
      return {
        context: withState(context, "awaiting_info_followup"),
        reply: messages.requestInfoMessage(context),
      };
    case "not_ready":
      return {
        context: withState(context, "awaiting_not_ready_followup"),
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

function handlePromptResponse(
  context: ContactConversationContext,
  inboundText: string,
): TransitionResult {
  const ctx = withInbound(context, inboundText);
  const signals = getSignals(inboundText);

  if (shouldSendCalendarNow(signals)) {
    if (
      signals.pains.includes("after_hours") ||
      includesAfterHoursNeed(inboundText) ||
      inboundText.toLowerCase().includes("after 5")
    ) {
      return complete(ctx, messages.urgentAfterHoursCalendarMessage(ctx), {
        detectedPains: signals.pains,
      });
    }
    return complete(ctx, messages.calendarMessage(ctx), { detectedPains: signals.pains });
  }

  if (signals.notReady || signals.requestInformation || includesAnyLookingForInfo(inboundText)) {
    return {
      context: withState(ctx, "awaiting_info_area", { detectedPains: signals.pains }),
      reply: messages.infoAreaQuestion(ctx),
    };
  }

  const followUpKind = chooseFollowUpKind(signals.pains, inboundText);

  if (followUpKind === "none" || signals.pains.length === 0) {
    if (signals.vague) {
      return complete(ctx, messages.calendarMessage(ctx));
    }
    return complete(ctx, messages.calendarMessage(ctx));
  }

  if (followUpKind === "website") {
    return {
      context: withState(ctx, "awaiting_follow_up", {
        followUpKind: "website",
        detectedPains: signals.pains,
      }),
      reply: messages.websiteFollowUpQuestion(ctx),
    };
  }

  if (followUpKind === "missed_calls") {
    return {
      context: withState(ctx, "awaiting_follow_up", {
        followUpKind: "missed_calls",
        detectedPains: signals.pains,
      }),
      reply: messages.missedCallsFollowUpQuestion(ctx),
    };
  }

  return complete(ctx, messages.calendarMessage(ctx), { detectedPains: signals.pains });
}

function includesAnyLookingForInfo(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("just looking") ||
    lower.includes("looking for information") ||
    lower.includes("more information")
  );
}

function isInformationSeeking(text: string): boolean {
  return includesAnyLookingForInfo(text);
}

function handleFollowUpResponse(
  context: ContactConversationContext,
  inboundText: string,
): TransitionResult {
  const ctx = withInbound(context, inboundText);

  if (context.followUpKind === "website") {
    return complete(ctx, messages.websiteCalendarMessage(ctx));
  }

  return complete(ctx, messages.calendarMessage(ctx));
}

function handleInfoAreaResponse(
  context: ContactConversationContext,
  inboundText: string,
): TransitionResult {
  const ctx = withInbound(context, inboundText);
  const text = inboundText.toLowerCase();

  if (text.includes("website") || text.includes("web site")) {
    return complete(ctx, messages.faqWebsiteBrief(ctx));
  }

  return complete(ctx, messages.faqVoiceBrief(ctx));
}

function migrateLegacyState(state: string): ContactConversationState {
  return "awaiting_prompt";
}

function isKnownState(state: string): state is ContactConversationState {
  return [
    "awaiting_prompt",
    "awaiting_follow_up",
    "awaiting_info_area",
    "awaiting_faq_followup",
    "awaiting_not_ready_followup",
    "awaiting_info_followup",
    "awaiting_answering_service_gap",
    "awaiting_office_staff_task",
    "completed",
  ].includes(state);
}

export function advanceContactConversation(
  context: ContactConversationContext,
  inboundText: string,
): TransitionResult {
  const state =
    context.state === "awaiting_contact_goal" || !isKnownState(context.state)
      ? migrateLegacyState(context.state)
      : context.state;

  const workingContext = state === context.state ? context : withState(context, state);

  if (workingContext.state === "awaiting_prompt" && isInformationSeeking(inboundText)) {
    return {
      context: withState(withInbound(workingContext, inboundText), "awaiting_info_area"),
      reply: messages.infoAreaQuestion(workingContext),
    };
  }

  if (!FREE_FORM_STATES.has(workingContext.state)) {
    const global = handleGlobalIntents(workingContext, inboundText);
    if (global) {
      return global;
    }
  }

  switch (workingContext.state) {
    case "awaiting_prompt":
      return handlePromptResponse(workingContext, inboundText);

    case "awaiting_follow_up":
      return handleFollowUpResponse(workingContext, inboundText);

    case "awaiting_info_area":
      return handleInfoAreaResponse(workingContext, inboundText);

    case "awaiting_faq_followup":
      return complete(
        withInbound(workingContext, inboundText),
        messages.scheduleYesMessage(workingContext),
      );

    case "awaiting_info_followup": {
      const signals = getSignals(inboundText);
      if (signals.yes) {
        return complete(
          withInbound(workingContext, inboundText),
          messages.requestInfoFollowUp(workingContext),
        );
      }
      return complete(withInbound(workingContext, inboundText), messages.declineMessage());
    }

    case "awaiting_not_ready_followup": {
      const signals = getSignals(inboundText);
      if (signals.yes) {
        return complete(
          withInbound(workingContext, inboundText),
          messages.notReadyFollowUp(workingContext),
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
      return handlePromptResponse(workingContext, inboundText);

    default:
      return handlePromptResponse(withState(workingContext, "awaiting_prompt"), inboundText);
  }
}
