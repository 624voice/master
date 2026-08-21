import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import {
  buildBookingConfirmationMessage,
  buildContextualSlotOfferMessage,
  calendarLinkFallbackMessage,
  validateOutboundSms,
} from "~/server/speed2Lead/guardrails";
import type { SlotOfferSituation } from "~/server/speed2Lead/schedulingReply";
import {
  inferAvailabilityInputFromMessage,
  resolveAvailabilityRange,
  resolveLaterThisWeekRange,
  type AvailabilityRangeInput,
} from "~/server/speed2Lead/schedulingRange";
import {
  applyConfirmedScheduling,
  applySchedulingMeta,
  applySchedulingIntent,
  applyOfferedSlots,
  applySchedulingConstraints,
} from "~/server/speed2Lead/memory";
import type { KnownFacts, SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import {
  buildAvailabilityInputFromSchedulingState,
  detectRepetitionCorrection,
  detectSchedulingConstraints,
  detectSchedulingRefinement,
  extractRequestedTimeMinutes,
  findMatchingOfferedSlots,
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
  hasExplicitExactTimeRequest,
  looksLikeSlotSelectionIntent,
  mergeSchedulingIntentFromMessage,
  needsMeridiemClarification,
  offeredSlotSetKey,
  parseFlexibleTimeToken,
  resolveRequestedMinutesFromMessage,
  slotMatchesMinutes,
} from "~/server/speed2Lead/schedulingContext";
import { shouldBlockSchedulingTurn, shouldTreatAsStrongInterest } from "~/server/speed2Lead/conversationDisposition";
import { slotStartMinutes } from "~/server/speed2Lead/slotRanking";
import { executeOrchestratorTool, shouldSuggestCalendarLink, type ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type SchedulingGateAction =
  | { type: "none" }
  | { type: "ask_preference" }
  | { type: "get_availability"; input: AvailabilityRangeInput; reason: string }
  | { type: "book_appointment"; start: string; reason: string }
  | { type: "get_availability_for_request"; input: AvailabilityRangeInput; reason: string };

export type SchedulingGatePlan = {
  action: SchedulingGateAction;
  schedulingIntent: boolean;
  strongInterest: boolean;
  explicitCalendarLinkRequest: boolean;
  selectedSlotStart: string | null;
  preferenceInput: AvailabilityRangeInput | null;
};

const STRONG_INTEREST_RE =
  /\b(yes|yeah|yep|sure|let'?s\s+(?:talk|chat|connect|do\s+it)|i'?m\s+interested|i'?d\s+like\s+to\s+(?:see|talk|chat|connect|learn)|can\s+we\s+(?:set\s+(?:up|something)|schedule|talk|chat|connect)|set\s+(?:something|it)\s+up|schedule\s+(?:a\s+)?(?:call|time|consultation)|how\s+this\s+would\s+work|ready\s+to\s+book|sounds\s+useful|show\s+me)\b/i;

const SCHEDULING_INTENT_RE =
  /\b(when\s+(?:are\s+you|can\s+we)|what\s+times?|available|availability|schedule|book|appointment|consultation|set\s+(?:something|it)\s+up|pick\s+a\s+time|find\s+a\s+time|talk\s+(?:tomorrow|today|this\s+week|next\s+week)|meet|call\s+(?:me|tomorrow|today))\b/i;

const EXPLICIT_AVAILABILITY_QUESTION_RE =
  /\b(when\s+are\s+you\s+available|what\s+times?\s+(?:do\s+you\s+have|work)|any\s+openings?|your\s+availability)\b/i;

const EXPLICIT_CALENDAR_LINK_RE =
  /\b(calendar\s+link|send\s+(?:me\s+)?(?:the\s+)?link|self[\s-]?service|book\s+online|schedule\s+online|pick\s+from\s+(?:the\s+)?calendar)\b/i;

const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;

const TIME_HINT_RE =
  /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|afternoon|evening|noon|midday|later\s+this\s+week|this\s+week|next\s+week)\b/i;

const ORDINAL_SLOT_RE =
  /\b(first|1st|second|2nd|third|3rd|fourth|4th|last|that\s+one|this\s+one)\b/i;

const TIME_SELECTION_RE =
  /\b(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i;

const NON_SELECTION_SCHEDULING_REQUEST_RE =
  /\b(?:instead|anything\s+around|do\s+you\s+have|any(?:thing)?\s+(?:around|at|for|open)|what\s+about|how\s+about|different\s+time|other\s+time|later\s+time|something\s+(?:around|at|closer))\b/i;

const SLOT_SELECTION_AFFIRMATIVE_RE =
  /\b(works?|good|perfect|sounds\s+good|book|take|grab|yes|yeah|yep|sure|ok(?:ay)?|that\s+one|this\s+one|i'?ll\s+take|lets?\s+do|the\s+\d|that\s+\d|slot)\b/i;

/** Max minutes a requested time may differ from an offered slot when affirmatively selecting. */
const SLOT_SELECTION_MAX_DELTA_MINUTES = 30;

const IMPLIED_AVAILABILITY_RE =
  /\b(i\s+have\s+(?:some\s+)?openings?|here\s+are\s+(?:some\s+)?(?:times|slots|options)|let\s+me\s+(?:find|check|look\s+for)\s+(?:a\s+)?time|let'?s\s+find\s+a\s+time|find\s+a\s+time\s+that\s+works)\b/i;

const SCHEDULING_DISCUSSION_RE =
  /\b(schedule|appointment|consultation|available|availability|set\s+(?:something|it)\s+up|find\s+a\s+time|pick\s+a\s+time|what\s+(?:day|time)|when\s+(?:works|are\s+you))\b/i;

function hasSchedulingPreference(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\blater\s+this\s+week\b/.test(lower)) return true;
  if (WEEKDAY_RE.test(lower)) return true;
  if (TIME_HINT_RE.test(lower)) return true;
  return false;
}

function detectStrongInterest(
  message: string,
  knownFacts: KnownFacts,
  context?: AnyConversationContext,
): boolean {
  if (context && !shouldTreatAsStrongInterest(message, context)) {
    return false;
  }
  if (knownFacts.urgency === "high" || knownFacts.fit === "yes") return true;
  return STRONG_INTEREST_RE.test(message);
}

function detectSchedulingIntent(
  message: string,
  knownFacts: KnownFacts,
  context?: AnyConversationContext,
): boolean {
  if (context && shouldBlockSchedulingTurn(context, message)) {
    return false;
  }
  if (detectStrongInterest(message, knownFacts, context)) return true;
  if (SCHEDULING_INTENT_RE.test(message)) return true;
  if (hasSchedulingPreference(message)) return true;
  return false;
}

function detectExplicitCalendarLinkRequest(message: string): boolean {
  return EXPLICIT_CALENDAR_LINK_RE.test(message);
}

function shouldAskPartOfDayOnly(scheduling?: SchedulingState): boolean {
  return hasKnownSchedulingDay(scheduling) && !hasKnownSchedulingPartOfDay(scheduling);
}

function shouldAskPreferenceOnly(
  message: string,
  knownFacts: KnownFacts,
  scheduling?: SchedulingState,
): boolean {
  if (shouldAskPartOfDayOnly(scheduling)) return true;
  if (!detectStrongInterest(message, knownFacts)) return false;
  if (hasSchedulingPreference(message)) return false;
  if (hasKnownSchedulingDay(scheduling) && hasKnownSchedulingPartOfDay(scheduling)) {
    return false;
  }
  if (EXPLICIT_AVAILABILITY_QUESTION_RE.test(message)) return false;
  if (detectRepetitionCorrection(message)) return false;
  return true;
}

function defaultAvailabilityInput(now: Date): AvailabilityRangeInput {
  const range = resolveLaterThisWeekRange(now);
  return {
    rangeStart: range.rangeStart.toISOString(),
    rangeEnd: range.rangeEnd.toISOString(),
  };
}

function buildPreferenceInput(
  message: string,
  now: Date,
  context?: AnyConversationContext,
): AvailabilityRangeInput | null {
  const scheduling = context?.scheduling;
  const offered = scheduling?.offeredSlots ?? [];
  const hasWeekdayInMessage = WEEKDAY_RE.test(message);
  const requestedMinutes = resolveRequestedMinutesFromMessage(message, offered);
  const anchorToOfferedDay =
    offered.length > 0 &&
    (isNonSelectionSchedulingRequest(message) ||
      (requestedMinutes !== null && !hasWeekdayInMessage && !looksLikeSlotSelectionIntent(message)));

  if (anchorToOfferedDay) {
    const anchor = inferAvailabilityInputFromOfferedSlot(offered[0]!);
    if (anchor) {
      return {
        ...anchor,
        centralDate: scheduling?.centralDate ?? anchor.centralDate,
        partOfDay:
          inferPartOfDayFromMessage(message) ??
          scheduling?.partOfDay ??
          anchor.partOfDay,
      };
    }
  }

  const fromState = buildAvailabilityInputFromSchedulingState(scheduling, message, now);
  if (fromState) {
    return fromState;
  }

  return inferAvailabilityInputFromMessage(message, now);
}

function inferPartOfDayFromMessage(message: string): AvailabilityRangeInput["partOfDay"] | null {
  const lower = message.toLowerCase();
  if (/\b(morning|before noon)\b/.test(lower)) return "morning";
  if (/\b(after lunch|afternoon)\b/.test(lower)) return "afternoon";
  if (/\b(evening)\b/.test(lower)) return "evening";
  const timeMatch = message.match(TIME_SELECTION_RE);
  if (timeMatch) {
    const minutes = parseTimeToMinutes(timeMatch[1] ?? "");
    if (minutes !== null) {
      if (minutes < 12 * 60) return "morning";
      if (minutes < 17 * 60) return "afternoon";
      return "evening";
    }
  }
  return null;
}

function isNonSelectionSchedulingRequest(message: string): boolean {
  if (NON_SELECTION_SCHEDULING_REQUEST_RE.test(message)) return true;
  if (/\?\s*$/.test(message.trim()) && TIME_SELECTION_RE.test(message)) return true;
  return false;
}

function findClosestOfferedSlot(
  requestedMinutes: number,
  offeredSlots: string[],
  maxDeltaMinutes: number,
): string | null {
  let best: string | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const start of offeredSlots) {
    const slotMinutes = slotStartMinutesFromIso(start);
    if (slotMinutes === null) continue;
    const delta = Math.abs(slotMinutes - requestedMinutes);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = start;
    }
  }
  if (best && bestDelta <= maxDeltaMinutes) return best;
  return null;
}

function slotLabel(startIso: string): string {
  const { time, timezoneShort } = formatTimeOnly(startIso, CONSULTATION_TIMEZONE);
  return timezoneShort ? `${time} ${timezoneShort}` : time;
}

function parseTimeToMinutes(raw: string): number | null {
  return parseFlexibleTimeToken(raw);
}

function slotStartMinutesFromIso(startIso: string): number | null {
  return slotStartMinutes(startIso);
}

function resolveOrdinalIndex(message: string, slotCount: number): number | null {
  const lower = message.toLowerCase();
  if (/\b(first|1st|that\s+first)\b/.test(lower)) return 0;
  if (/\b(second|2nd|middle)\b/.test(lower)) return Math.min(1, slotCount - 1);
  if (/\b(third|3rd)\b/.test(lower)) return Math.min(2, slotCount - 1);
  if (/\b(fourth|4th|last)\b/.test(lower)) return slotCount - 1;
  if (
    /\b(that\s+one|this\s+one|that\s+works|this\s+works|works|good|perfect|sounds\s+good)\b/.test(
      lower,
    ) &&
    slotCount === 1
  ) {
    return 0;
  }
  return null;
}

export function resolveOfferedSlotSelection(
  message: string,
  offeredSlots: string[],
): string | null {
  if (offeredSlots.length === 0) return null;
  if (isNonSelectionSchedulingRequest(message)) return null;

  const ordinal = resolveOrdinalIndex(message, offeredSlots.length);
  if (ordinal !== null && offeredSlots[ordinal]) {
    return offeredSlots[ordinal] ?? null;
  }

  const requestedMinutes = resolveRequestedMinutesFromMessage(message, offeredSlots);
  if (requestedMinutes !== null) {
    const exactMatches = findMatchingOfferedSlots(message, offeredSlots, 0);
    if (exactMatches.length === 1) {
      return exactMatches[0] ?? null;
    }

    if (
      SLOT_SELECTION_AFFIRMATIVE_RE.test(message) ||
      looksLikeSlotSelectionIntent(message) ||
      /\b(that|this)\b/i.test(message)
    ) {
      return findClosestOfferedSlot(
        requestedMinutes,
        offeredSlots,
        SLOT_SELECTION_MAX_DELTA_MINUTES,
      );
    }

    const nearMatches = offeredSlots.filter((slot) =>
      slotMatchesMinutes(slot, requestedMinutes, SLOT_SELECTION_MAX_DELTA_MINUTES),
    );
    if (nearMatches.length === 1) {
      return nearMatches[0] ?? null;
    }
  }

  if (/\b(last one|final one)\b/i.test(message)) {
    return offeredSlots[offeredSlots.length - 1] ?? null;
  }

  if (
    /\b(yes|yeah|yep|that works|that one|this one|book it|sounds good|sure)\b/i.test(message) &&
    offeredSlots.length === 1
  ) {
    return offeredSlots[0] ?? null;
  }

  if (ORDINAL_SLOT_RE.test(message) && offeredSlots.length === 1) {
    return offeredSlots[0] ?? null;
  }

  return null;
}

function buildMeridiemClarificationMessage(message: string, offeredSlots: string[]): string {
  const token = message.match(/\b(\d{1,2}(?::\d{2})?|\d{3,4})\b/i)?.[1] ?? "that time";
  const amMinutes = resolveRequestedMinutesFromMessage(`${token} am`, offeredSlots);
  const pmMinutes = resolveRequestedMinutesFromMessage(`${token} pm`, offeredSlots);
  const parts: string[] = [];
  if (amMinutes != null) {
    const hour = Math.floor(amMinutes / 60);
    const minute = amMinutes % 60;
    parts.push(
      `${hour}:${String(minute).padStart(2, "0")} AM`.replace(/^0/, "").replace(":0", ":"),
    );
  }
  if (pmMinutes != null) {
    const hour = Math.floor(pmMinutes / 60);
    const minute = pmMinutes % 60;
    const displayHour = hour > 12 ? hour - 12 : hour;
    parts.push(`${displayHour}:${String(minute).padStart(2, "0")} PM`);
  }
  return `Just to confirm — did you mean ${parts.join(" or ")}?`;
}

function inferSlotOfferSituation(args: {
  inboundMessage: string;
  scheduling?: SchedulingState;
  actionReason?: string;
  slots: string[];
}): SlotOfferSituation {
  if (args.actionReason === "refine_later" || args.actionReason === "refine_earlier") {
    return "refinement";
  }
  if (args.actionReason === "exact_time_request") {
    return "exact_unavailable";
  }
  if (
    args.actionReason === "refine_anchor_time" ||
    args.actionReason === "refine_part_of_day" ||
    args.actionReason === "non_offered_time_requested"
  ) {
    return "narrowed";
  }
  if (/\b(none of those|not those|doesn'?t work|too early|too late)\b/i.test(args.inboundMessage)) {
    return "after_rejection";
  }
  if ((args.scheduling?.rejectedSlotStarts?.length ?? 0) > 0) {
    return "after_rejection";
  }
  if (args.slots.length <= 2 && (args.scheduling?.offeredSlots?.length ?? 0) > args.slots.length) {
    return "narrowed";
  }
  return "first_offer";
}

function shouldRepeatSlotOffer(args: {
  slots: string[];
  scheduling?: SchedulingState;
  inboundMessage: string;
  allowRepeat: boolean;
}): boolean {
  if (args.allowRepeat) return true;
  if (args.slots.length === 0) return false;
  const nextKey = offeredSlotSetKey(args.slots);
  if (nextKey !== args.scheduling?.lastOfferedSlotKey) return true;
  if (looksLikeSlotSelectionIntent(args.inboundMessage)) return false;
  if (resolveOfferedSlotSelection(args.inboundMessage, args.scheduling?.offeredSlots ?? args.slots)) {
    return false;
  }
  if (/\b(again|repeat|what were|remind me|show me)\b/i.test(args.inboundMessage)) return true;
  return false;
}

function buildDeterministicSlotOffer(args: {
  slots: string[];
  inboundMessage: string;
  scheduling?: SchedulingState;
  actionReason?: string;
  allowRepeat?: boolean;
  situationOverride?: SlotOfferSituation;
}): string | null {
  if (
    !shouldRepeatSlotOffer({
      slots: args.slots,
      scheduling: args.scheduling,
      inboundMessage: args.inboundMessage,
      allowRepeat: args.allowRepeat ?? false,
    })
  ) {
    return null;
  }

  const situation =
    args.situationOverride ??
    inferSlotOfferSituation({
      inboundMessage: args.inboundMessage,
      scheduling: args.scheduling,
      actionReason: args.actionReason,
      slots: args.slots,
    });

  return buildContextualSlotOfferMessage({
    slots: args.slots,
    situation,
    variationSeed: offeredSlotSetKey(args.slots),
  });
}

export function planSchedulingGate(args: {
  inboundMessage: string;
  context: AnyConversationContext;
  now?: Date;
}): SchedulingGatePlan {
  const now = args.now ?? new Date();
  const { inboundMessage, context } = args;

  if (shouldBlockSchedulingTurn(context, inboundMessage)) {
    return {
      action: { type: "none" },
      schedulingIntent: false,
      strongInterest: false,
      explicitCalendarLinkRequest: detectExplicitCalendarLinkRequest(inboundMessage),
      selectedSlotStart: null,
      preferenceInput: null,
    };
  }

  const scheduling = context.scheduling;

  if (scheduling?.status === "confirmed") {
    return {
      action: { type: "none" },
      schedulingIntent: false,
      strongInterest: false,
      explicitCalendarLinkRequest: detectExplicitCalendarLinkRequest(inboundMessage),
      selectedSlotStart: null,
      preferenceInput: null,
    };
  }

  const knownFacts = context.knownFacts ?? {
    firstName: context.firstName,
    phone: context.phone,
    flow: context.flow ?? "roi",
    questionsAsked: 0,
  };
  const explicitCalendarLinkRequest = detectExplicitCalendarLinkRequest(inboundMessage);
  const schedulingIntent = detectSchedulingIntent(inboundMessage, knownFacts, context);
  const strongInterest = detectStrongInterest(inboundMessage, knownFacts, context);
  const preferenceInput = buildPreferenceInput(inboundMessage, now, context);

  if (scheduling?.status === "slots_offered" && (scheduling.offeredSlots?.length ?? 0) > 0) {
    const offered = scheduling.offeredSlots ?? [];
    const selected = resolveOfferedSlotSelection(inboundMessage, offered);
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

    if (needsMeridiemClarification(inboundMessage, offered)) {
      return {
        action: { type: "ask_preference" },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput,
      };
    }

    const refinement = detectSchedulingRefinement(inboundMessage, scheduling, offered, now);
    if (refinement) {
      return {
        action: {
          type: "get_availability_for_request",
          input: refinement.input,
          reason: refinement.reason,
        },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: refinement.input,
      };
    }

    const looksLikeSelection =
      looksLikeSlotSelectionIntent(inboundMessage) ||
      findMatchingOfferedSlots(inboundMessage, offered, SLOT_SELECTION_MAX_DELTA_MINUTES).length > 0;

    const requestsDifferentTime =
      !looksLikeSelection &&
      (hasSchedulingPreference(inboundMessage) ||
        (resolveRequestedMinutesFromMessage(inboundMessage, offered) !== null &&
          isNonSelectionSchedulingRequest(inboundMessage)) ||
        /\b(instead|anything around|different time|other time|later time)\b/i.test(inboundMessage));

    if (requestsDifferentTime) {
      const requestInput = preferenceInput ?? defaultAvailabilityInput(now);
      return {
        action: {
          type: "get_availability_for_request",
          input: requestInput,
          reason: "non_offered_time_requested",
        },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: requestInput,
      };
    }
  }

  if (detectRepetitionCorrection(inboundMessage)) {
    const requestInput =
      buildAvailabilityInputFromSchedulingState(scheduling, inboundMessage, now) ??
      preferenceInput ??
      defaultAvailabilityInput(now);
    return {
      action: {
        type: "get_availability",
        input: requestInput,
        reason: "repetition_correction_recovery",
      },
      schedulingIntent: true,
      strongInterest,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: requestInput,
    };
  }

  if (schedulingIntent) {
    if (shouldAskPreferenceOnly(inboundMessage, knownFacts, scheduling)) {
      return {
        action: { type: "ask_preference" },
        schedulingIntent: true,
        strongInterest: true,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: null,
      };
    }

    const accumulatedInput =
      buildAvailabilityInputFromSchedulingState(scheduling, inboundMessage, now) ?? preferenceInput;
    const exactMinutes = resolveRequestedMinutesFromMessage(
      inboundMessage,
      scheduling?.offeredSlots ?? [],
    );
    if (
      exactMinutes != null &&
      accumulatedInput?.centralDate &&
      hasExplicitExactTimeRequest(inboundMessage, scheduling) &&
      scheduling?.status !== "slots_offered"
    ) {
      return {
        action: {
          type: "get_availability_for_request",
          input: accumulatedInput,
          reason: "exact_time_request",
        },
        schedulingIntent: true,
        strongInterest,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: accumulatedInput,
      };
    }

    const input =
      accumulatedInput ??
      defaultAvailabilityInput(now);
    return {
      action: { type: "get_availability", input, reason: "scheduling_intent" },
      schedulingIntent: true,
      strongInterest,
      explicitCalendarLinkRequest,
      selectedSlotStart: null,
      preferenceInput: input,
    };
  }

  return {
    action: { type: "none" },
    schedulingIntent,
    strongInterest,
    explicitCalendarLinkRequest,
    selectedSlotStart: null,
    preferenceInput,
  };
}

export function allowCalendarLinkFallback(args: {
  plan: SchedulingGatePlan;
  toolState: ToolExecutionState;
}): boolean {
  if (args.plan.explicitCalendarLinkRequest) return true;
  if (args.toolState.calendarUnavailable) return true;
  if (args.toolState.availabilityAttempts >= 2 && args.toolState.offeredSlots.length === 0) {
    return true;
  }
  if (args.toolState.bookingAttempts >= 2 && !args.toolState.bookingConfirmed) {
    return true;
  }
  return false;
}

function availabilityToolArgs(input: AvailabilityRangeInput, now: Date): Record<string, unknown> {
  return {
    rangeStart: input.rangeStart ?? null,
    rangeEnd: input.rangeEnd ?? null,
    centralDate: input.centralDate ?? null,
    partOfDay: input.partOfDay ?? null,
    maxSlots: 3,
  };
}

async function runGetAvailability(
  input: AvailabilityRangeInput,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  now: Date,
): Promise<{ context: AnyConversationContext; toolState: ToolExecutionState }> {
  const executed = await executeOrchestratorTool(
    "get_availability",
    availabilityToolArgs(input, now),
    context,
    toolState,
    now,
  );
  return { context: executed.context, toolState: executed.state };
}

async function runBookAppointment(
  start: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  now: Date,
): Promise<{ context: AnyConversationContext; toolState: ToolExecutionState; result: unknown }> {
  const executed = await executeOrchestratorTool(
    "book_appointment",
    { start, notes: null },
    context,
    toolState,
    now,
  );
  return { context: executed.context, toolState: executed.state, result: executed.result };
}

export function schedulingRequestKey(input: AvailabilityRangeInput): string {
  if (input.rangeStart && input.rangeEnd) {
    return `range:${input.rangeStart}|${input.rangeEnd}|${input.partOfDay ?? "full_day"}`;
  }
  return `date:${input.centralDate ?? "unknown"}|${input.partOfDay ?? "full_day"}`;
}

export function isActiveV2Scheduling(context: AnyConversationContext): boolean {
  const scheduling = context.scheduling;
  if (!scheduling) return false;
  if (scheduling.status === "slots_offered" && (scheduling.offeredSlots?.length ?? 0) > 0) {
    return true;
  }
  if (scheduling.status === "confirmed") return true;
  if ((scheduling.availabilityAttempts ?? 0) > 0) return true;
  if ((scheduling.bookingAttempts ?? 0) > 0) return true;
  return false;
}

export function hydrateToolStateFromContext(
  context: AnyConversationContext,
  base: ToolExecutionState,
): ToolExecutionState {
  const scheduling = context.scheduling ?? { status: "idle" as const };
  return {
    ...base,
    offeredSlots: scheduling.offeredSlots ?? base.offeredSlots,
    bookingConfirmed: scheduling.status === "confirmed",
    bookingStart: scheduling.selectedStart,
    bookingEventId: scheduling.calendarEventId,
    calendarUnavailable: scheduling.calendarUnavailable ?? base.calendarUnavailable,
    availabilityAttempts: scheduling.availabilityAttempts ?? 0,
    bookingAttempts: scheduling.bookingAttempts ?? 0,
  };
}

export function persistSchedulingToolState(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  activeRequestKey?: string,
): AnyConversationContext {
  let updated = context;

  if (toolState.bookingConfirmed && toolState.bookingStart && toolState.bookingEventId) {
    updated = applyConfirmedScheduling(updated, {
      selectedStart: toolState.bookingStart,
      calendarEventId: toolState.bookingEventId,
    });
  } else if (toolState.offeredSlots.length > 0) {
    updated = applyOfferedSlots(updated, toolState.offeredSlots);
  }

  return applySchedulingMeta(updated, {
    activeRequestKey: activeRequestKey ?? updated.scheduling?.activeRequestKey,
    availabilityAttempts: toolState.availabilityAttempts,
    bookingAttempts: toolState.bookingAttempts,
    calendarUnavailable: toolState.calendarUnavailable,
  });
}

function prepareToolStateForRequest(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  requestKey: string,
): ToolExecutionState {
  const priorKey = context.scheduling?.activeRequestKey;
  if (priorKey && priorKey !== requestKey) {
    return {
      ...toolState,
      availabilityAttempts: 0,
      bookingAttempts: 0,
      bookingFailed: false,
      offeredSlots: [],
    };
  }
  return { ...toolState, bookingFailed: false };
}

function recordAvailabilityAttempt(
  toolState: ToolExecutionState,
  slotsReturned: number,
): ToolExecutionState {
  if (slotsReturned > 0) {
    return {
      ...toolState,
      availabilityAttempts: 0,
      bookingFailed: false,
    };
  }
  return {
    ...toolState,
    availabilityAttempts: toolState.availabilityAttempts + 1,
  };
}

export function validateDeterministicSchedulingReply(
  text: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  calendarLinkAllowed: boolean,
): { ok: true; text: string } | { ok: false; reason: string } {
  const sanitized = stripUnauthorizedCalendarLink(text, calendarLinkAllowed);
  return validateOutboundSms(sanitized, { session: context, toolState });
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

  if (!schedulingTurn) {
    return null;
  }

  if (toolState.bookingConfirmed && toolState.lifecycleConfirmationSent) {
    return "";
  }

  if (calendarLinkAllowed && shouldSuggestCalendarLink(toolState)) {
    const linkReply = calendarLinkFallbackMessage(context);
    const linkPass = validateDeterministicSchedulingReply(
      linkReply,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (linkPass.ok) return linkPass.text;
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

  const composed = selectOutboundSchedulingReply({
    llmReply: args.llmReply,
    gateResult,
    firstName: args.firstName,
  });
  const composedPass = validateDeterministicSchedulingReply(
    composed,
    context,
    toolState,
    calendarLinkAllowed,
  );
  if (composedPass.ok) return composedPass.text;

  if (toolState.bookingConfirmed && toolState.bookingStart) {
    if (toolState.lifecycleConfirmationSent) {
      return "";
    }
    const confirmation = buildConfirmedReply(context, toolState);
    if (!confirmation) {
      return "";
    }
    const confirmPass = validateDeterministicSchedulingReply(
      confirmation,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (confirmPass.ok) return confirmPass.text;
  }

  if (toolState.offeredSlots.length > 0) {
    const offer =
      buildDeterministicSlotOffer({
        slots: toolState.offeredSlots,
        inboundMessage: "",
        scheduling: context,
        allowRepeat: true,
        situationOverride: "repeat_recovery",
      }) ?? buildContextualSlotOfferMessage({
        slots: toolState.offeredSlots,
        situation: "repeat_recovery",
      });
    const offerPass = validateDeterministicSchedulingReply(
      offer,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (offerPass.ok) return offerPass.text;
  }

  if (gateResult.forcedReply) {
    const retryPass = validateDeterministicSchedulingReply(
      gateResult.forcedReply,
      context,
      toolState,
      calendarLinkAllowed,
    );
    if (retryPass.ok) return retryPass.text;
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

function inferAvailabilityInputFromOfferedSlot(
  startIso: string,
): AvailabilityRangeInput | null {
  const parts = parseCentralParts(new Date(startIso), CONSULTATION_TIMEZONE);
  const centralDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return { centralDate, partOfDay: "full_day" };
}

function formatAskPartOfDay(firstName: string): string {
  return `Happy to find a time, ${firstName} — would morning or afternoon work better?`;
}

function formatAskPreference(firstName: string, scheduling?: SchedulingState): string {
  if (shouldAskPartOfDayOnly(scheduling)) {
    return formatAskPartOfDay(firstName);
  }

  const hasDay = hasKnownSchedulingDay(scheduling);
  const hasPart = hasKnownSchedulingPartOfDay(scheduling);

  if (hasDay && hasPart) {
    return `Got it, ${firstName} — let me check what I have open.`;
  }

  if (hasDay) {
    return `Happy to set up a quick call, ${firstName} — would morning or afternoon work better that day?`;
  }

  return `Happy to set up a quick call, ${firstName} — what day works best for you?`;
}

function bookingConfirmationOptions(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
): {
  email?: string;
  sendsCalendarInvite?: boolean;
  useLifecycleCopy?: boolean;
} {
  const email =
    context.knownFacts?.email ?? ("email" in context ? context.email : undefined);
  return {
    email,
    sendsCalendarInvite: Boolean(email),
    useLifecycleCopy: toolState.lifecycleConfirmationSent === true,
  };
}

function buildConfirmedReply(
  context: AnyConversationContext,
  toolState: ToolExecutionState,
): string | null {
  if (!toolState.bookingConfirmed || !toolState.bookingStart) return null;
  const options = bookingConfirmationOptions(context, toolState);
  if (options.useLifecycleCopy) return null;
  return buildBookingConfirmationMessage(toolState.bookingStart, context.firstName, options);
}

function formatConflictReply(
  slots: string[],
  inboundMessage: string,
  scheduling?: SchedulingState,
): string {
  if (slots.length === 0) {
    return "That time just got taken. What day works best for you instead?";
  }
  const offer =
    buildDeterministicSlotOffer({
      slots,
      inboundMessage,
      scheduling,
      allowRepeat: true,
      situationOverride: "conflict",
    }) ?? buildContextualSlotOfferMessage({ slots, situation: "conflict" });
  return offer.startsWith("That time just got taken")
    ? offer
    : `That time just got taken — ${offer.charAt(0).toLowerCase()}${offer.slice(1)}`;
}

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
};

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

  const constraintPatch = detectSchedulingConstraints(
    args.inboundMessage,
    context.scheduling,
    context.scheduling?.offeredSlots ?? [],
  );
  if (Object.keys(constraintPatch).length > 0) {
    context = applySchedulingConstraints(context, constraintPatch);
  }

  context = applySchedulingMeta(
    context,
    mergeSchedulingIntentFromMessage(context.scheduling, args.inboundMessage, now),
  );
  let forcedReply: string | null = null;
  let gateApplied = false;
  let availabilityFetched = args.llmCalledGetAvailability;
  let bookingAttempted = args.llmCalledBookAppointment;
  let activeRequestKey = context.scheduling?.activeRequestKey;

  const calendarLinkAllowed = allowCalendarLinkFallback({
    plan: args.plan,
    toolState,
  });

  const action = args.plan.action;

  if (action.type === "ask_preference") {
    gateApplied = true;
    if (needsMeridiemClarification(args.inboundMessage, context.scheduling?.offeredSlots ?? [])) {
      forcedReply = buildMeridiemClarificationMessage(
        args.inboundMessage,
        context.scheduling?.offeredSlots ?? [],
      );
    } else {
      const asksPreference = /\b(what day|which day|morning or afternoon)\b/i.test(args.llmReply);
      if (!asksPreference || mentionsUnauthorizedAvailability(args.llmReply, toolState)) {
        forcedReply = formatAskPreference(context.firstName, context.scheduling);
      }
    }
    context = persistSchedulingToolState(context, toolState, activeRequestKey);
    return {
      context,
      toolState,
      forcedReply,
      gateApplied,
      calendarLinkAllowed,
      availabilityFetched,
      bookingAttempted,
      activeRequestKey,
      schedulingIntent: args.plan.schedulingIntent,
    };
  }

  if (action.type === "get_availability" || action.type === "get_availability_for_request") {
    const requestKey = schedulingRequestKey(action.input);
    activeRequestKey = requestKey;
    toolState = prepareToolStateForRequest(context, toolState, requestKey);

    const mustRefreshAvailability =
      action.type === "get_availability_for_request" ||
      !args.llmCalledGetAvailability ||
      toolState.offeredSlots.length === 0;

    if (mustRefreshAvailability) {
      gateApplied = gateApplied || !args.llmCalledGetAvailability || action.type === "get_availability_for_request";
      const refinement = detectSchedulingRefinement(
        args.inboundMessage,
        context.scheduling,
        context.scheduling?.offeredSlots ?? [],
        now,
      );
      context = applySchedulingIntent(context, action.input, {
        anchorTimeMinutes:
          action.reason === "exact_time_request"
            ? (resolveRequestedMinutesFromMessage(args.inboundMessage, context.scheduling?.offeredSlots ?? []) ??
              refinement?.rankPreferences.anchorMinutes ??
              context.scheduling?.anchorTimeMinutes)
            : (refinement?.rankPreferences.anchorMinutes ?? context.scheduling?.anchorTimeMinutes),
        searchAfterMinutes:
          refinement?.rankPreferences.searchAfterMinutes ?? context.scheduling?.searchAfterMinutes,
        searchBeforeMinutes:
          refinement?.rankPreferences.searchBeforeMinutes ?? context.scheduling?.searchBeforeMinutes,
        earliestAllowedMinutes: context.scheduling?.earliestAllowedMinutes,
        latestAllowedMinutes: context.scheduling?.latestAllowedMinutes,
        rejectedPartOfDay: context.scheduling?.rejectedPartOfDay,
        rejectedSlotStarts: context.scheduling?.rejectedSlotStarts,
      });
      context = applySchedulingMeta(
        context,
        mergeSchedulingIntentFromMessage(context.scheduling, args.inboundMessage, now),
      );
      const fetched = await runGetAvailability(action.input, context, toolState, now);
      context = fetched.context;
      toolState = recordAvailabilityAttempt(fetched.toolState, fetched.toolState.offeredSlots.length);
      availabilityFetched = true;
    }

    if (
      action.type === "get_availability_for_request" &&
      action.reason === "exact_time_request" &&
      toolState.offeredSlots.length > 0 &&
      !toolState.bookingConfirmed
    ) {
      const exactMinutes =
        resolveRequestedMinutesFromMessage(args.inboundMessage, toolState.offeredSlots) ??
        context.scheduling?.anchorTimeMinutes;
      const exactSlot =
        exactMinutes != null
          ? toolState.offeredSlots.find((slot) => slotMatchesMinutes(slot, exactMinutes, 0))
          : null;
      if (exactSlot) {
        gateApplied = true;
        bookingAttempted = true;
        context = applySchedulingMeta(context, { bookingPending: true });
        const booked = await runBookAppointment(exactSlot, context, toolState, now);
        context = booked.context;
        toolState = booked.toolState;
        if (toolState.bookingConfirmed) {
          context = applySchedulingMeta(context, { bookingPending: false });
          forcedReply = buildConfirmedReply(context, toolState);
        }
      }
    }

    const slots = toolState.offeredSlots;
    const actionReason = action.type === "get_availability_for_request" ? action.reason : "scheduling_intent";
    if (
      slots.length > 0 &&
      !toolState.bookingConfirmed &&
      (gateApplied ||
        !args.llmReply.trim() ||
        mentionsUnauthorizedAvailability(args.llmReply, toolState) ||
        !args.llmCalledGetAvailability)
    ) {
      forcedReply =
        buildDeterministicSlotOffer({
          slots,
          inboundMessage: args.inboundMessage,
          scheduling: context.scheduling,
          actionReason,
          allowRepeat: action.type === "get_availability_for_request",
        }) ??
        (looksLikeSlotSelectionIntent(args.inboundMessage)
          ? `Got it — booking that now.`
          : null);
    } else if (gateApplied && slots.length === 0) {
      if (hasKnownSchedulingDay(context.scheduling) && hasKnownSchedulingPartOfDay(context.scheduling)) {
        forcedReply = `I don't have anything open in that window — want to try another time on that day?`;
      } else {
        forcedReply = formatAskPreference(context.firstName, context.scheduling);
      }
    }
  }

  if (action.type === "book_appointment") {
    if (!toolState.bookingConfirmed) {
      gateApplied = gateApplied || !args.llmCalledBookAppointment;
      bookingAttempted = true;
      context = applySchedulingMeta(context, { bookingPending: true });
      const booked = await runBookAppointment(action.start, context, toolState, now);
      context = booked.context;
      toolState = booked.toolState;

      if (toolState.bookingConfirmed && toolState.bookingStart) {
        context = applySchedulingMeta(context, { bookingPending: false });
        forcedReply = buildConfirmedReply(context, toolState);
      } else if (toolState.bookingFailed) {
        context = applySchedulingMeta(context, { bookingPending: false });
        const refreshInput =
          args.plan.preferenceInput ??
          inferAvailabilityInputFromMessage(args.inboundMessage, now) ??
          inferAvailabilityInputFromOfferedSlot(action.start) ??
          defaultAvailabilityInput(now);
        const refreshKey = schedulingRequestKey(refreshInput);
        activeRequestKey = refreshKey;
        toolState = prepareToolStateForRequest(context, toolState, refreshKey);
        const refreshed = await runGetAvailability(refreshInput, context, toolState, now);
        context =
          refreshed.toolState.offeredSlots.length > 0
            ? applyOfferedSlots(refreshed.context, refreshed.toolState.offeredSlots)
            : refreshed.context;
        toolState = {
          ...recordAvailabilityAttempt(refreshed.toolState, refreshed.toolState.offeredSlots.length),
          bookingFailed: false,
        };
        availabilityFetched = true;
        forcedReply = formatConflictReply(
          toolState.offeredSlots,
          args.inboundMessage,
          context.scheduling,
        );
      } else if (bookingAttempted) {
        context = applySchedulingMeta(context, { bookingPending: false });
        forcedReply = `I hit a snag booking that — mind sending the time once more?`;
      }
    }
  }

  if (
    args.plan.schedulingIntent &&
    args.plan.action.type === "none" &&
    !availabilityFetched &&
    (SCHEDULING_DISCUSSION_RE.test(args.llmReply) || IMPLIED_AVAILABILITY_RE.test(args.llmReply))
  ) {
    gateApplied = true;
    const input = args.plan.preferenceInput ?? defaultAvailabilityInput(now);
    activeRequestKey = schedulingRequestKey(input);
    toolState = prepareToolStateForRequest(context, toolState, activeRequestKey);
    const fetched = await runGetAvailability(input, context, toolState, now);
    context = fetched.context;
    toolState = recordAvailabilityAttempt(fetched.toolState, fetched.toolState.offeredSlots.length);
    availabilityFetched = true;
    forcedReply =
      toolState.offeredSlots.length > 0
        ? buildDeterministicSlotOffer({
            slots: toolState.offeredSlots,
            inboundMessage: args.inboundMessage,
            scheduling: context.scheduling,
            allowRepeat: true,
          }) ?? formatAskPreference(context.firstName, context.scheduling)
        : formatAskPreference(context.firstName, context.scheduling);
  }

  if (
    gateApplied &&
    !forcedReply &&
    args.plan.action.type === "book_appointment" &&
    bookingAttempted &&
    !toolState.bookingConfirmed
  ) {
    forcedReply = `I hit a snag booking that — mind sending the time once more?`;
  }

  context = persistSchedulingToolState(context, toolState, activeRequestKey);

  return {
    context,
    toolState,
    forcedReply,
    gateApplied,
    calendarLinkAllowed,
    availabilityFetched,
    bookingAttempted,
    activeRequestKey,
    schedulingIntent: args.plan.schedulingIntent,
  };
}

function mentionsUnauthorizedAvailability(reply: string, toolState: ToolExecutionState): boolean {
  if (toolState.bookingConfirmed) return false;
  if (IMPLIED_AVAILABILITY_RE.test(reply)) return true;
  if (toolState.offeredSlots.length === 0) {
    return mentionsUnlistedTimes(reply, []);
  }
  return mentionsUnlistedTimes(reply, toolState.offeredSlots);
}

function mentionsUnlistedTimes(reply: string, allowedSlots: string[]): boolean {
  const timePattern = /\b(?:1[0-2]|0?[1-9]):[0-5]\d(?:\s*(?:am|pm))?\b/gi;
  const matches = reply.match(timePattern) ?? [];
  if (matches.length === 0) return false;
  if (allowedSlots.length === 0) return matches.length > 0;

  const allowedLabels = allowedSlots.map((slot) => slotLabel(slot).toLowerCase());
  return matches.some((match) => {
    const token = match.toLowerCase();
    return !allowedLabels.some((label) => label.includes(token.replace(/\s+/g, " ")));
  });
}

export function stripUnauthorizedCalendarLink(reply: string, allowed: boolean): string {
  if (allowed) return reply;
  return reply.replace(/https?:\/\/[^\s]+/g, "").replace(/\s{2,}/g, " ").trim();
}

export function selectOutboundSchedulingReply(args: {
  llmReply: string;
  gateResult: SchedulingGateResult;
  firstName: string;
}): string {
  const { llmReply, gateResult } = args;
  const draft = llmReply.trim();
  const { forcedReply, gateApplied, toolState } = gateResult;

  if (toolState.bookingConfirmed && forcedReply) {
    return forcedReply;
  }

  if (forcedReply && gateApplied) {
    const preferenceQuestion = /\b(what day|which day|morning or afternoon)\b/i.test(draft);
    if (mentionsUnauthorizedAvailability(draft, toolState)) {
      return forcedReply;
    }
    if (toolState.offeredSlots.length > 0 && mentionsUnlistedTimes(draft, toolState.offeredSlots)) {
      return forcedReply;
    }
    if (toolState.offeredSlots.length === 0 && !preferenceQuestion) {
      return forcedReply;
    }
  }

  if (draft) {
    return draft;
  }

  return forcedReply ?? "";
}
