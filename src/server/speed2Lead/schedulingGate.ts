import { CONSULTATION_TIMEZONE, getConsultationBusinessHours, getConsultationDurationMinutes } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBookingConfirmationMessage,
  calendarLinkFallbackMessage,
  finalizeCalendarLinkOutbound,
  validateOutboundSms,
} from "~/server/speed2Lead/guardrails";
import { applyConfirmedScheduling, applySchedulingMeta, normalizeSessionMemory } from "~/server/speed2Lead/memory";
import { shouldBlockSchedulingForMeetingBridge, canEnterScheduling, UNCERTAINTY_PHRASE_RE, hasOngoingSchedulingState } from "~/server/speed2Lead/conversationHandoff";
import { shouldBlockSchedulingTurn, shouldDeferSchedulingForDiscovery, shouldTreatAsStrongInterest } from "~/server/speed2Lead/conversationDisposition";
import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  buildAvailabilityInputFromSchedulingState,
  classifySchedulingTimeIntent,
  detectRepetitionCorrection,
  detectSchedulingRefinement,
  detectSchedulingConstraints,
  hasExplicitExactTimeRequest,
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
  needsMeridiemClarification,
  resolveOfferedSlotSelectionCandidate,
} from "~/server/speed2Lead/schedulingContext";
import type { AvailabilityRangeInput } from "~/server/speed2Lead/schedulingRange";
import { inferAvailabilityInputFromMessage } from "~/server/speed2Lead/schedulingRange";
import { schedulingFactsComplete } from "~/server/speed2Lead/schedulingIntent";
import {
  buildReplyFromSchedulingResult,
  markOfferPresented,
  processSchedulingTurn,
} from "~/server/scheduling/service";
import {
  fromCanonicalSchedulingState,
  toCanonicalSchedulingState,
  buildRequestFromCanonicalState,
} from "~/server/scheduling/state";
import type { SchedulingOutcomeType } from "~/server/scheduling/types";
import {
  mergeIntentIntoState,
  parseSchedulingIntentUpdate,
} from "~/server/scheduling/intentParser";
import type { SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import type { ToolExecutionState } from "~/server/speed2Lead/tools";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import { logSpeed2LeadTestEvent } from "~/server/speed2Lead/testObservability";
import { buildNeedDateCopy, buildSlotOfferCopy } from "~/server/scheduling/copy";
import { calendarAttendeeInviteEnabled } from "~/server/appointmentLifecycle/googleCalendar";
import { preferenceToLegacyPartOfDay } from "~/server/scheduling/requestKey";
import { buildSchedulingRequestKey } from "~/server/scheduling/requestKey";
import {
  buildSchedulingCustomerQuestionReply,
  detectSchedulingCustomerQuestion,
  isSchedulingCustomerQuestion,
  type SchedulingCustomerQuestionKind,
} from "~/server/speed2Lead/customerQuestions";

export type SchedulingGateAction =
  | { type: "none" }
  | { type: "ask_preference" }
  | { type: "answer_customer_question"; kind: SchedulingCustomerQuestionKind }
  | { type: "get_availability"; input: AvailabilityRangeInput; reason: string }
  | { type: "get_availability_for_request"; input: AvailabilityRangeInput; reason: string }
  | { type: "book_appointment"; start: string; reason: string };

export type SchedulingGatePlan = {
  action: SchedulingGateAction;
  schedulingIntent: boolean;
  strongInterest: boolean;
  explicitCalendarLinkRequest: boolean;
  selectedSlotStart: string | null;
  preferenceInput: AvailabilityRangeInput | null;
};

export type SchedulingGateResult = {
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  forcedReply: string | null;
  gateApplied: boolean;
  calendarLinkAllowed: boolean;
  availabilityFetched: boolean;
  bookingAttempted: boolean;
  activeRequestKey?: string;
  schedulingIntent: boolean;
  outcome?: SchedulingOutcomeType;
};

const EXPLICIT_CALENDAR_LINK_RE =
  /\b(calendar\s+link|send\s+(?:me\s+)?(?:the\s+)?link|self[\s-]?service|book\s+online|schedule\s+online|pick\s+from\s+(?:the\s+)?calendar)\b/i;

const SCHEDULING_INTENT_RE =
  /\b(when\s+(?:are\s+you|can\s+we)|what\s+times?|what\s+do\s+you\s+have\s+open|available|availability|schedule|book|appointment|consultation|set\s+(?:something|it)\s+up|pick\s+a\s+time|find\s+a\s+time|talk\s+(?:tomorrow|today|this\s+week|next\s+week)|meet|call\s+(?:me|tomorrow|today)|first\s+available|anytime|flexible|whenever|this\s+week|later\s+this\s+week)\b/i;

const DAYPART_ONLY_RE =
  /^(?:\s*(?:let'?s\s+do\s+)?(?:morning|afternoon|evening)(?:\s+please)?\.?\s*)$/i;

function hasRefinementSignal(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredCount: number,
): boolean {
  if (offeredCount > 0) return true;
  if (
    /\b(instead|need something later|something later|switch to|no morning|no afternoon|not morning|not afternoon|later time|earlier time|anything around|different time|other time)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(what about|how about)\b/i.test(message) &&
    hasKnownSchedulingPartOfDay(scheduling)
  ) {
    return true;
  }
  if (/\b(around|about)\s+\d/i.test(message)) return true;
  return false;
}

const STRONG_INTEREST_RE =
  /\b(yes|yeah|yep|let'?s\s+(?:talk|chat|connect|do\s+it)|i'?m\s+interested|ready\s+to\s+book|sounds\s+useful)\b/i;

const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i;

function detectStrongInterest(message: string, context?: AnyConversationContext): boolean {
  if (UNCERTAINTY_PHRASE_RE.test(message.toLowerCase())) return false;
  if (context && !shouldTreatAsStrongInterest(message, context)) return false;
  return STRONG_INTEREST_RE.test(message);
}

function detectSchedulingIntent(message: string, context?: AnyConversationContext, now = new Date()): boolean {
  const signals = analyzeMessage(message);
  if (signals.priceQuestion || signals.tellMeMore || signals.faqQuestion) return false;
  if (context && shouldBlockSchedulingTurn(context, message)) return false;
  if (context && shouldBlockSchedulingForMeetingBridge(context, message)) return false;
  if (context && shouldDeferSchedulingForDiscovery(context, message)) return false;

  const ongoingScheduling = context ? hasOngoingSchedulingState(context) : false;
  if (context && !canEnterScheduling(context, message) && !ongoingScheduling) {
    return false;
  }

  if (context && shouldTreatAsStrongInterest(message, context) && detectStrongInterest(message, context)) {
    return true;
  }
  if (SCHEDULING_INTENT_RE.test(message)) return true;
  if (WEEKDAY_RE.test(message)) return true;
  if (DAYPART_ONLY_RE.test(message.trim())) return true;

  if (context) {
    if (isActiveV2Scheduling(context)) return true;
    if (schedulingFactsComplete(context.scheduling)) return true;
    if (hasKnownSchedulingDay(context.scheduling) || hasKnownSchedulingPartOfDay(context.scheduling)) {
      if (DAYPART_ONLY_RE.test(message.trim()) || detectRepetitionCorrection(message)) {
        return true;
      }
    }
    const canonical = toCanonicalSchedulingState(context.scheduling);
    const patch = parseSchedulingIntentUpdate(message, canonical, now);
    if (patch.requestedDate || patch.availabilityPreference || patch.exactTimeMinutes != null || patch.anchorTime != null) {
      return true;
    }
    const constraints = detectSchedulingConstraints(
      message,
      context.scheduling,
      context.scheduling?.offeredSlots ?? [],
    );
    if (
      constraints.rejectedPartOfDay?.length ||
      constraints.rejectedSlotStarts?.length ||
      constraints.partOfDay ||
      constraints.centralDate
    ) {
      return true;
    }
  }

  return false;
}

function detectExplicitCalendarLinkRequest(message: string): boolean {
  return EXPLICIT_CALENDAR_LINK_RE.test(message);
}

function toAvailabilityInput(
  canonical: ReturnType<typeof toCanonicalSchedulingState>,
): AvailabilityRangeInput | null {
  if (!canonical.requestedDate && canonical.availabilityPreference !== "earliest") {
    return null;
  }
  return {
    centralDate: canonical.requestedDate,
    partOfDay: preferenceToLegacyPartOfDay(canonical.availabilityPreference),
  };
}

function needsDaypartQuestion(canonical: ReturnType<typeof toCanonicalSchedulingState>): boolean {
  if (!canonical.requestedDate) return false;
  if (canonical.availabilityPreference === "earliest") return false;
  if (canonical.anchorTimeMinutes != null) return false;
  if (
    canonical.availabilityPreference === "full_day" ||
    canonical.availabilityPreference === "morning" ||
    canonical.availabilityPreference === "afternoon" ||
    canonical.availabilityPreference === "evening" ||
    canonical.availabilityPreference === "exact_time"
  ) {
    return false;
  }
  return true;
}

function resolveBookingCustomer(context: AnyConversationContext) {
  const normalized = normalizeSessionMemory(context);
  return {
    phone: normalized.phone,
    name:
      normalized.flow === "demo"
        ? `${normalized.firstName} ${(normalized as AnyConversationContext & { lastName?: string }).lastName ?? ""}`.trim()
        : normalized.firstName,
    email: normalized.knownFacts?.email ?? ("email" in normalized ? normalized.email : undefined),
    businessName: normalized.knownFacts?.businessName,
    source: (normalized.flow ?? "roi") as "roi" | "contact" | "demo",
  };
}

function syncToolStateFromScheduling(
  toolState: ToolExecutionState,
  scheduling: SchedulingState,
  outcome?: SchedulingOutcomeType,
): ToolExecutionState {
  const offered = scheduling.offeredSlots ?? [];
  return {
    ...toolState,
    offeredSlots: offered,
    bookingConfirmed: scheduling.status === "confirmed",
    bookingStart: scheduling.selectedStart,
    bookingEventId: scheduling.calendarEventId,
    calendarUnavailable: scheduling.calendarUnavailable ?? toolState.calendarUnavailable,
    providerFailureReason: scheduling.providerFailureReason,
    availabilityAttempts: scheduling.availabilityAttempts ?? toolState.availabilityAttempts,
    bookingFailed: outcome === "PROVIDER_CONFLICT",
    lastBookingFailureReason:
      outcome === "PROVIDER_CONFLICT"
        ? "provider_conflict"
        : outcome === "INVALID_SELECTION"
          ? "invalid_selection"
          : outcome === "PROVIDER_ERROR"
            ? "provider_error"
            : toolState.lastBookingFailureReason,
  };
}

function persistSchedulingToContext(
  context: AnyConversationContext,
  canonical: ReturnType<typeof toCanonicalSchedulingState>,
): AnyConversationContext {
  return applySchedulingMeta(context, fromCanonicalSchedulingState(canonical));
}

export function planSchedulingGate(args: {
  inboundMessage: string;
  context: AnyConversationContext;
  now?: Date;
}): SchedulingGatePlan {
  const now = args.now ?? new Date();
  const explicitCalendarLinkRequest = detectExplicitCalendarLinkRequest(args.inboundMessage);

  if (shouldBlockSchedulingTurn(args.context, args.inboundMessage)) {
    return {
      action: { type: "none" },
      schedulingIntent: false,
      strongInterest: false,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: null,
    };
  }

  if (args.context.scheduling?.status === "confirmed") {
    const customerQuestion = detectSchedulingCustomerQuestion(args.inboundMessage, args.context);
    if (isSchedulingCustomerQuestion(customerQuestion)) {
      return {
        action: { type: "answer_customer_question", kind: customerQuestion },
        schedulingIntent: true,
        strongInterest: false,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: null,
      };
    }
    return {
      action: { type: "none" },
      schedulingIntent: false,
      strongInterest: false,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: null,
    };
  }

  const earlyCustomerQuestion = detectSchedulingCustomerQuestion(args.inboundMessage, args.context);
  if (
    isSchedulingCustomerQuestion(earlyCustomerQuestion) &&
    (isActiveV2Scheduling(args.context) || schedulingFactsComplete(args.context.scheduling))
  ) {
    return {
      action: { type: "answer_customer_question", kind: earlyCustomerQuestion },
      schedulingIntent: true,
      strongInterest: false,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: toAvailabilityInput(toCanonicalSchedulingState(args.context.scheduling)),
    };
  }

  const schedulingIntent = detectSchedulingIntent(args.inboundMessage, args.context, now);
  const strongInterest = detectStrongInterest(args.inboundMessage, args.context);
  let canonical = toCanonicalSchedulingState(args.context.scheduling);
  const patch = parseSchedulingIntentUpdate(args.inboundMessage, canonical, now);
  canonical = mergeIntentIntoState(canonical, patch);
  const preferenceInput = toAvailabilityInput(canonical);

  const offered = args.context.scheduling?.offeredSlots ?? [];
  if (offered.length > 0) {
    const selected = resolveOfferedSlotSelectionCandidate(args.inboundMessage, offered);
    if (selected) {
      return {
        action: { type: "book_appointment", start: selected, reason: "offered_slot_selected" },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: selected,
        preferenceInput,
      };
    }

    if (needsMeridiemClarification(args.inboundMessage, offered)) {
      return {
        action: { type: "ask_preference" },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput,
      };
    }
  }

  const inferredRange = inferAvailabilityInputFromMessage(args.inboundMessage, now);
  if (inferredRange?.rangeStart && inferredRange.rangeEnd) {
    return {
      action: { type: "get_availability", input: inferredRange, reason: "range_request" },
      schedulingIntent: true,
      strongInterest: strongInterest || schedulingIntent,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: inferredRange,
    };
  }

  if (
    hasExplicitExactTimeRequest(args.inboundMessage, args.context.scheduling) &&
    (hasKnownSchedulingDay(args.context.scheduling) || Boolean(canonical.requestedDate))
  ) {
    const input =
      buildAvailabilityInputFromSchedulingState(args.context.scheduling, args.inboundMessage, now) ??
      preferenceInput;
    if (input?.centralDate) {
      return {
        action: {
          type: "get_availability_for_request",
          input,
          reason: "exact_time_request",
        },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: input,
      };
    }
  }

  const canRefine =
    hasRefinementSignal(args.inboundMessage, args.context.scheduling, offered.length) &&
    (offered.length > 0 ||
      hasKnownSchedulingDay(args.context.scheduling) ||
      hasKnownSchedulingPartOfDay(args.context.scheduling) ||
      args.context.scheduling?.status === "slots_offered");
  const refinement = canRefine
    ? detectSchedulingRefinement(
        args.inboundMessage,
        args.context.scheduling,
        offered,
        now,
      )
    : null;
  if (refinement) {
    return {
      action: {
        type: "get_availability_for_request",
        input: refinement.input,
        reason: refinement.reason,
      },
      schedulingIntent: true,
      strongInterest: strongInterest || schedulingIntent,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: refinement.input,
    };
  }

  if (
    offered.length > 0 &&
    classifySchedulingTimeIntent(args.inboundMessage, args.context.scheduling) === "request"
  ) {
    const input =
      buildAvailabilityInputFromSchedulingState(args.context.scheduling, args.inboundMessage, now) ??
      preferenceInput;
    if (input?.centralDate || (input?.rangeStart && input.rangeEnd)) {
      return {
        action: {
          type: "get_availability_for_request",
          input,
          reason: "exact_time_request",
        },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: input,
      };
    }
  }

  if (!schedulingIntent) {
    return {
      action: { type: "none" },
      schedulingIntent: false,
      strongInterest,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput,
    };
  }

  if (needsDaypartQuestion(canonical)) {
    return {
      action: { type: "ask_preference" },
      schedulingIntent: true,
      strongInterest: strongInterest || schedulingIntent,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput,
    };
  }

  const request = buildRequestFromCanonicalState(
    canonical,
    CONSULTATION_TIMEZONE,
    getConsultationBusinessHours(),
    getConsultationDurationMinutes(),
  );

  if (!request) {
    return {
      action: { type: "ask_preference" },
      schedulingIntent: true,
      strongInterest: strongInterest || schedulingIntent,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: null,
    };
  }

  const input = preferenceInput ?? {
    centralDate: request.requestedDate,
    partOfDay: preferenceToLegacyPartOfDay(request.availabilityPreference),
  };

  return {
    action: { type: "get_availability", input, reason: "scheduling_intent" },
    schedulingIntent: true,
    strongInterest: strongInterest || schedulingIntent,
    explicitCalendarLinkRequest,
    selectedSlotStart: null,
    preferenceInput: input,
  };
}

export function requiresDeterministicSchedulingCompletion(
  plan: SchedulingGatePlan,
  _context: AnyConversationContext,
): boolean {
  if (plan.action.type === "book_appointment") return true;
  if (plan.action.type === "answer_customer_question") return true;
  if (plan.action.type === "get_availability" || plan.action.type === "get_availability_for_request") {
    return Boolean(plan.action.input.centralDate || (plan.action.input.rangeStart && plan.action.input.rangeEnd));
  }
  return false;
}

export function hydrateToolStateFromContext(
  context: AnyConversationContext,
  base: ToolExecutionState,
): ToolExecutionState {
  return syncToolStateFromScheduling(base, context.scheduling ?? { status: "idle" });
}

export function persistSchedulingToolState(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  activeRequestKey?: string,
): AnyConversationContext {
  return applySchedulingMeta(context, {
    activeRequestKey: activeRequestKey ?? context.scheduling?.activeRequestKey,
    offeredSlots: toolState.offeredSlots.length > 0 ? toolState.offeredSlots : undefined,
    status: toolState.bookingConfirmed
      ? "confirmed"
      : toolState.offeredSlots.length > 0
        ? "slots_offered"
        : context.scheduling?.status ?? "idle",
    selectedStart: toolState.bookingStart,
    calendarEventId: toolState.bookingEventId,
    calendarUnavailable: toolState.calendarUnavailable,
    providerFailureReason: toolState.providerFailureReason,
  });
}

function resolveForcedSchedulingReply(
  result: import("~/server/scheduling/types").SchedulingTurnResult,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  plan: SchedulingGatePlan,
): string | null {
  const linkAllowed = allowCalendarLinkFallback({ plan, toolState, context });
  if (
    linkAllowed &&
    (result.outcome === "PROVIDER_ERROR" || result.outcome === "NO_AVAILABILITY") &&
    result.offeredSlots.length === 0 &&
    !result.closedDayDate
  ) {
    return calendarLinkFallbackMessage(context);
  }
  return buildReplyFromSchedulingResult(result);
}

export async function enforceSchedulingGate(args: {
  plan: SchedulingGatePlan;
  inboundMessage: string;
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  llmReply: string;
  llmCalledGetAvailability: boolean;
  llmCalledBookAppointment: boolean;
  now?: Date;
}): Promise<SchedulingGateResult> {
  const now = args.now ?? new Date();
  let { context, toolState } = args;
  let forcedReply: string | null = null;
  let gateApplied = false;
  let availabilityFetched = false;
  let bookingAttempted = false;
  let outcome: SchedulingOutcomeType | undefined;

  const calendarLinkAllowed =
    allowCalendarLinkFallback({ plan: args.plan, toolState, context }) ||
    args.plan.explicitCalendarLinkRequest ||
    (toolState.bookingAttempts >= 2 && !toolState.bookingConfirmed);

  if (!args.plan.schedulingIntent || args.plan.action.type === "none") {
    return {
      context,
      toolState,
      forcedReply: null,
      gateApplied: false,
      calendarLinkAllowed,
      availabilityFetched,
      bookingAttempted,
      activeRequestKey: context.scheduling?.activeRequestKey,
      schedulingIntent: args.plan.schedulingIntent,
    };
  }

  if (args.plan.action.type === "ask_preference") {
    gateApplied = true;
    forcedReply = needsDaypartQuestion(toCanonicalSchedulingState(context.scheduling))
      ? "Morning or afternoon?"
      : buildNeedDateCopy();
    return {
      context,
      toolState,
      forcedReply,
      gateApplied,
      calendarLinkAllowed,
      availabilityFetched,
      bookingAttempted,
      activeRequestKey: context.scheduling?.activeRequestKey,
      schedulingIntent: args.plan.schedulingIntent,
      outcome: "NEED_DATE",
    };
  }

  if (args.plan.action.type === "answer_customer_question") {
    gateApplied = true;
    forcedReply =
      buildSchedulingCustomerQuestionReply({
        kind: args.plan.action.kind,
        context,
        toolState,
        inboundMessage: args.inboundMessage,
      }) ?? buildSchedulingResumeReply(context);
    return {
      context,
      toolState,
      forcedReply,
      gateApplied,
      calendarLinkAllowed,
      availabilityFetched,
      bookingAttempted,
      activeRequestKey: context.scheduling?.activeRequestKey,
      schedulingIntent: args.plan.schedulingIntent,
    };
  }

  gateApplied = true;
  const phoneSuffix = context.phone.slice(-4);
  const explicitBookStart =
    args.plan.action.type === "book_appointment" ? args.plan.action.start : undefined;
  const availabilityInput =
    args.plan.action.type === "get_availability" ||
    args.plan.action.type === "get_availability_for_request"
      ? args.plan.action.input
      : undefined;
  const result = await processSchedulingTurn({
    inboundMessage: args.inboundMessage,
    state: toCanonicalSchedulingState(context.scheduling),
    now,
    bookCustomer: resolveBookingCustomer(context),
    tracePhoneSuffix: phoneSuffix,
    explicitBookStart,
    availabilityInput,
  });

  outcome = result.outcome;
  availabilityFetched = result.trace.providerInvoked;
  bookingAttempted = result.trace.bookingAttempted;

  let presentedState = markOfferPresented(result.state, result.offeredSlots);
  const legacyState = fromCanonicalSchedulingState(presentedState);
  context = applySchedulingMeta(context, {
    ...legacyState,
    rejectedPartOfDay: presentedState.rejectedPartOfDay,
    rejectedSlotStarts: presentedState.rejectedSlotStarts,
  });
  toolState = syncToolStateFromScheduling(
    toolState,
    fromCanonicalSchedulingState(presentedState),
    outcome,
  );

  if (result.trace.providerInvoked) {
    toolState = {
      ...toolState,
      availabilityAttempts:
        result.offeredSlots.length > 0 ? 0 : toolState.availabilityAttempts + 1,
      calendarUnavailable:
        result.outcome === "PROVIDER_ERROR" ? true : toolState.calendarUnavailable,
      providerFailureReason:
        result.state.providerFailureReason ?? toolState.providerFailureReason,
    };
    context = applySchedulingMeta(context, {
      availabilityAttempts: toolState.availabilityAttempts,
      calendarUnavailable: toolState.calendarUnavailable,
      providerFailureReason: toolState.providerFailureReason,
    });
  }

  if (result.outcome === "BOOKED" && result.selectedStart && result.eventId) {
    bookingAttempted = true;
    context = applyConfirmedScheduling(context, {
      selectedStart: result.selectedStart,
      calendarEventId: result.eventId,
      googleMeetUrl: result.googleMeetUrl,
    });
    toolState = {
      ...syncToolStateFromScheduling(toolState, context.scheduling!, outcome),
      lifecycleConfirmationSent: result.lifecycleConfirmationSent === true,
    };
    const email =
      context.knownFacts?.email ?? ("email" in context ? context.email : undefined);
    forcedReply = buildBookingConfirmationMessage(result.selectedStart, context.firstName, {
      email,
      sendsCalendarInvite: calendarAttendeeInviteEnabled(email),
      useLifecycleCopy: toolState.lifecycleConfirmationSent === true,
      meetingLink: result.googleMeetUrl ?? context.scheduling?.googleMeetUrl,
    });
  } else {
    forcedReply = resolveForcedSchedulingReply(result, context, toolState, args.plan);
  }

  logSpeed2LeadTestEvent(context.phone, "availability_result", {
    slotCount: result.offeredSlots.length,
    source: "scheduling_service",
    outcome: result.outcome,
    providerInvoked: result.trace.providerInvoked ? 1 : 0,
    zeroSlotReason: result.trace.zeroSlotReason,
  });

  const resolvedCalendarLinkAllowed =
    allowCalendarLinkFallback({ plan: args.plan, toolState, context }) ||
    args.plan.explicitCalendarLinkRequest ||
    (toolState.bookingAttempts >= 2 && !toolState.bookingConfirmed);

  return {
    context,
    toolState,
    forcedReply,
    gateApplied,
    calendarLinkAllowed: resolvedCalendarLinkAllowed,
    availabilityFetched,
    bookingAttempted,
    activeRequestKey: presentedState.activeRequestKey,
    schedulingIntent: args.plan.schedulingIntent,
    outcome,
  };
}

export function validateDeterministicSchedulingReply(
  text: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  calendarLinkAllowed: boolean,
): { ok: true; text: string } | { ok: false; reason: string } {
  const sanitized = finalizeCalendarLinkOutbound(text, context, calendarLinkAllowed);
  if (!sanitized) {
    return { ok: false, reason: "blocked_self_scheduling_copy" };
  }
  return validateOutboundSms(sanitized, {
    session: context,
    toolState,
    calendarLinkAllowed,
  });
}

export function resolveAuthoritativeSchedulingReply(args: {
  gateResult: SchedulingGateResult;
  llmReply: string;
  firstName: string;
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  calendarLinkAllowed: boolean;
}): string | null {
  const { gateResult, context, toolState, calendarLinkAllowed } = args;
  const schedulingTurn =
    gateResult.gateApplied ||
    gateResult.availabilityFetched ||
    gateResult.bookingAttempted ||
    gateResult.schedulingIntent;

  if (!schedulingTurn) return null;

  if (toolState.bookingConfirmed && toolState.lifecycleConfirmationSent) {
    return "";
  }

  if (gateResult.gateApplied && gateResult.forcedReply) {
    const forcedPass = validateDeterministicSchedulingReply(
      gateResult.forcedReply,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (forcedPass.ok) return forcedPass.text;
  }

  if (toolState.bookingConfirmed && toolState.bookingStart) {
    if (toolState.lifecycleConfirmationSent) return "";
    const email =
      context.knownFacts?.email ?? ("email" in context ? context.email : undefined);
    const confirmation = buildBookingConfirmationMessage(toolState.bookingStart, context.firstName, {
      email,
      sendsCalendarInvite: calendarAttendeeInviteEnabled(email),
      useLifecycleCopy: false,
      meetingLink: context.scheduling?.googleMeetUrl,
    });
    const confirmPass = validateDeterministicSchedulingReply(
      confirmation,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (confirmPass.ok) return confirmPass.text;
  }

  return null;
}

export function buildDeterministicRecoveryReply(args: {
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  gateResult: SchedulingGateResult;
}): string | null {
  return resolveAuthoritativeSchedulingReply({
    gateResult: args.gateResult,
    llmReply: "",
    firstName: args.context.firstName,
    context: args.context,
    toolState: args.toolState,
    calendarLinkAllowed: args.gateResult.calendarLinkAllowed,
  });
}

export function buildSchedulingPreferenceAsk(
  _firstName: string,
  scheduling?: SchedulingState,
): string {
  if (scheduling?.requestedDate || scheduling?.centralDate) {
    return "Morning or afternoon?";
  }
  return buildNeedDateCopy();
}

export function buildSchedulingResumeReply(context: AnyConversationContext): string | null {
  const slots = context.scheduling?.offeredSlots ?? [];
  if (slots.length === 0) return null;
  const presentation =
    context.scheduling?.lastPresentedOfferKey === [...slots].sort().join("|")
      ? "repeat_offer"
      : "first_offer";
  return buildSlotOfferCopy(slots, presentation);
}

export function selectOutboundSchedulingReply(args: {
  llmReply: string;
  gateResult: SchedulingGateResult;
  firstName: string;
}): string {
  if (args.gateResult.forcedReply) return args.gateResult.forcedReply;
  return args.llmReply;
}

export function stripUnauthorizedCalendarLink(
  reply: string,
  allowed: boolean,
  context?: AnyConversationContext,
): string {
  if (!context) {
    if (allowed) return reply;
    return reply.replace(/https?:\/\/[^\s]+/g, "").replace(/\s{2,}/g, " ").trim();
  }
  return finalizeCalendarLinkOutbound(reply, context, allowed) ?? "";
}

export function allowCalendarLinkFallback(args: {
  plan: SchedulingGatePlan;
  toolState: ToolExecutionState;
  context?: AnyConversationContext;
}): boolean {
  if (args.context?.scheduling?.applicationLogicFailure) return false;
  if (args.plan.explicitCalendarLinkRequest) return true;
  if (
    args.toolState.calendarUnavailable &&
    args.toolState.availabilityAttempts >= 2 &&
    args.toolState.offeredSlots.length === 0
  ) {
    return true;
  }
  return false;
}

export function isAvailabilityFetchAuthorized(plan: SchedulingGatePlan): boolean {
  return (
    plan.action.type === "get_availability" ||
    plan.action.type === "get_availability_for_request" ||
    plan.action.type === "book_appointment"
  );
}

export function isActiveV2Scheduling(context: AnyConversationContext): boolean {
  const scheduling = context.scheduling;
  if (!scheduling) return false;
  if (scheduling.status === "slots_offered" && (scheduling.offeredSlots?.length ?? 0) > 0) return true;
  if (scheduling.status === "confirmed") return true;
  return Boolean(scheduling.activeRequestKey);
}

export function schedulingRequestKey(input: {
  centralDate?: string;
  requestedDate?: string;
  partOfDay?: string;
  availabilityPreference?: string;
  exactTimeMinutes?: number;
  lowerTimeBound?: number;
  upperTimeBound?: number;
  anchorTime?: number;
}): string {
  const date = input.requestedDate ?? input.centralDate ?? "unknown";
  const pref = (input.availabilityPreference ?? input.partOfDay ?? "full_day") as import("~/server/scheduling/types").AvailabilityPreference;
  return buildSchedulingRequestKey({
    timezone: CONSULTATION_TIMEZONE,
    requestedDate: date === "unknown" ? undefined : date,
    availabilityPreference: pref,
    exactTimeMinutes: input.exactTimeMinutes,
    lowerTimeBound: input.lowerTimeBound,
    upperTimeBound: input.upperTimeBound,
    anchorTime: input.anchorTime,
    businessHours: getConsultationBusinessHours(),
    meetingDurationMinutes: getConsultationDurationMinutes(),
  });
}

export function resolveOfferedSlotSelection(
  message: string,
  offeredSlots: string[],
): string | null {
  return resolveOfferedSlotSelectionCandidate(message, offeredSlots);
}

export { createInitialToolState };
