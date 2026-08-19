import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBookingConfirmationMessage,
  buildSlotOfferMessage,
} from "~/server/speed2Lead/guardrails";
import {
  inferAvailabilityInputFromMessage,
  resolveAvailabilityRange,
  resolveLaterThisWeekRange,
  type AvailabilityRangeInput,
} from "~/server/speed2Lead/schedulingRange";
import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";
import { executeOrchestratorTool, type ToolExecutionState } from "~/server/speed2Lead/tools";
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
  /\b(yes|yeah|yep|sure|ok(?:ay)?|let'?s\s+(?:talk|chat|connect|do\s+it)|i'?m\s+interested|i'?d\s+like\s+to\s+(?:see|talk|chat|connect|learn)|can\s+we\s+(?:set\s+(?:up|something)|schedule|talk|chat|connect)|set\s+(?:something|it)\s+up|schedule\s+(?:a\s+)?(?:call|time|consultation)|how\s+this\s+would\s+work)\b/i;

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

const TIME_SELECTION_RE = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))\b/i;

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

function detectStrongInterest(message: string, knownFacts: KnownFacts): boolean {
  if (knownFacts.urgency === "high" || knownFacts.fit === "yes") return true;
  return STRONG_INTEREST_RE.test(message);
}

function detectSchedulingIntent(message: string, knownFacts: KnownFacts): boolean {
  if (detectStrongInterest(message, knownFacts)) return true;
  if (SCHEDULING_INTENT_RE.test(message)) return true;
  if (hasSchedulingPreference(message)) return true;
  return false;
}

function detectExplicitCalendarLinkRequest(message: string): boolean {
  return EXPLICIT_CALENDAR_LINK_RE.test(message);
}

function shouldAskPreferenceOnly(message: string, knownFacts: KnownFacts): boolean {
  if (!detectStrongInterest(message, knownFacts)) return false;
  if (hasSchedulingPreference(message)) return false;
  if (EXPLICIT_AVAILABILITY_QUESTION_RE.test(message)) return false;
  return true;
}

function defaultAvailabilityInput(now: Date): AvailabilityRangeInput {
  const range = resolveLaterThisWeekRange(now);
  return {
    rangeStart: range.rangeStart.toISOString(),
    rangeEnd: range.rangeEnd.toISOString(),
  };
}

function buildPreferenceInput(message: string, now: Date): AvailabilityRangeInput | null {
  return inferAvailabilityInputFromMessage(message, now);
}

function slotLabel(startIso: string): string {
  const { time, timezoneShort } = formatTimeOnly(startIso, CONSULTATION_TIMEZONE);
  return timezoneShort ? `${time} ${timezoneShort}` : time;
}

function parseTimeToMinutes(raw: string): number | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  let meridiem = (match[3] ?? "").toLowerCase();
  if (!meridiem) {
    meridiem = hour >= 8 && hour <= 11 ? "am" : "pm";
  }
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour >= 24 || minute >= 60) return null;
  return hour * 60 + minute;
}

function slotStartMinutes(startIso: string): number | null {
  const { time } = formatTimeOnly(startIso, CONSULTATION_TIMEZONE);
  return parseTimeToMinutes(time);
}

function resolveOrdinalIndex(message: string, slotCount: number): number | null {
  const lower = message.toLowerCase();
  if (/\b(first|1st|that\s+first)\b/.test(lower)) return 0;
  if (/\b(second|2nd)\b/.test(lower)) return Math.min(1, slotCount - 1);
  if (/\b(third|3rd)\b/.test(lower)) return Math.min(2, slotCount - 1);
  if (/\b(fourth|4th|last)\b/.test(lower)) return slotCount - 1;
  if (/\b(that\s+one|this\s+one|works|good|perfect|sounds\s+good|the\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*(?:am|pm)\s+slot)\b/.test(lower) && slotCount === 1) {
    return 0;
  }
  return null;
}

export function resolveOfferedSlotSelection(
  message: string,
  offeredSlots: string[],
): string | null {
  if (offeredSlots.length === 0) return null;

  const ordinal = resolveOrdinalIndex(message, offeredSlots.length);
  if (ordinal !== null && offeredSlots[ordinal]) {
    return offeredSlots[ordinal] ?? null;
  }

  const lower = message.toLowerCase();
  for (const start of offeredSlots) {
    const label = slotLabel(start).toLowerCase();
    const weekdayMatch = label.match(/^(mon|tue|wed|thu|fri|sat|sun)/i);
    if (weekdayMatch && lower.includes(weekdayMatch[0]!.toLowerCase())) {
      const slotMinutes = slotStartMinutes(start);
      const timeMatch = message.match(TIME_SELECTION_RE);
      if (timeMatch) {
        const requested = parseTimeToMinutes(timeMatch[1] ?? "");
        if (requested !== null && slotMinutes !== null && Math.abs(requested - slotMinutes) <= 30) {
          return start;
        }
      } else if (/\b(morning|afternoon|evening)\b/i.test(message)) {
        const part = /\bmorning\b/i.test(message)
          ? "am"
          : /\bafternoon\b/i.test(message)
            ? "pm"
            : "pm";
        if (label.includes(part)) return start;
      } else if (/\bworks\b|\bgood\b|\bperfect\b|\bsounds\s+good\b/i.test(message)) {
        return start;
      }
    }
  }

  const bareTime = message.match(TIME_SELECTION_RE);
  if (bareTime) {
    const requested = parseTimeToMinutes(bareTime[1] ?? "");
    if (requested !== null) {
      let best: string | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const start of offeredSlots) {
        const slotMinutes = slotStartMinutes(start);
        if (slotMinutes === null) continue;
        const delta = Math.abs(slotMinutes - requested);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = start;
        }
      }
      if (best && bestDelta <= 45) return best;
    }
  }

  if (ORDINAL_SLOT_RE.test(message) && offeredSlots.length === 1) {
    return offeredSlots[0] ?? null;
  }

  return null;
}

export function planSchedulingGate(args: {
  inboundMessage: string;
  context: AnyConversationContext;
  now?: Date;
}): SchedulingGatePlan {
  const now = args.now ?? new Date();
  const { inboundMessage, context } = args;
  const knownFacts = context.knownFacts ?? {
    firstName: context.firstName,
    phone: context.phone,
    flow: context.flow ?? "roi",
    questionsAsked: 0,
  };
  const scheduling = context.scheduling;
  const explicitCalendarLinkRequest = detectExplicitCalendarLinkRequest(inboundMessage);
  const schedulingIntent = detectSchedulingIntent(inboundMessage, knownFacts);
  const strongInterest = detectStrongInterest(inboundMessage, knownFacts);
  const preferenceInput = buildPreferenceInput(inboundMessage, now);

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

    const requestsDifferentTime =
      hasSchedulingPreference(inboundMessage) ||
      TIME_SELECTION_RE.test(inboundMessage) ||
      /\b(instead|anything around|different time|other time|later time)\b/i.test(inboundMessage);

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

  if (schedulingIntent) {
    if (shouldAskPreferenceOnly(inboundMessage, knownFacts)) {
      return {
        action: { type: "ask_preference" },
        schedulingIntent: true,
        strongInterest: true,
        explicitCalendarLinkRequest,
        selectedSlotStart: null,
        preferenceInput: null,
      };
    }

    const input = preferenceInput ?? defaultAvailabilityInput(now);
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

function formatAskPreference(firstName: string): string {
  return `Happy to set up a quick call, ${firstName} — what day works best, morning or afternoon?`;
}

function formatConflictReply(slots: string[]): string {
  if (slots.length === 0) {
    return "That time just got taken. What day works best for you instead?";
  }
  const offer = buildSlotOfferMessage(slots);
  return `That time just got taken — ${offer.charAt(0).toLowerCase()}${offer.slice(1)}`;
}

export type SchedulingGateResult = {
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  forcedReply: string | null;
  gateApplied: boolean;
  calendarLinkAllowed: boolean;
  availabilityFetched: boolean;
  bookingAttempted: boolean;
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
  let forcedReply: string | null = null;
  let gateApplied = false;
  let availabilityFetched = args.llmCalledGetAvailability;
  let bookingAttempted = args.llmCalledBookAppointment;

  const calendarLinkAllowed = allowCalendarLinkFallback({
    plan: args.plan,
    toolState,
  });

  const action = args.plan.action;

  if (action.type === "ask_preference") {
    gateApplied = true;
    const asksPreference = /\b(what day|which day|morning or afternoon)\b/i.test(args.llmReply);
    if (!asksPreference || mentionsUnauthorizedAvailability(args.llmReply, toolState)) {
      forcedReply = formatAskPreference(context.firstName);
    }
    return {
      context,
      toolState,
      forcedReply,
      gateApplied,
      calendarLinkAllowed,
      availabilityFetched,
      bookingAttempted,
    };
  }

  if (action.type === "get_availability" || action.type === "get_availability_for_request") {
    if (!args.llmCalledGetAvailability) {
      gateApplied = true;
      const fetched = await runGetAvailability(action.input, context, toolState, now);
      context = fetched.context;
      toolState = fetched.toolState;
      availabilityFetched = true;
    }

    const slots = toolState.offeredSlots;
    if (
      slots.length > 0 &&
      (gateApplied ||
        !args.llmReply.trim() ||
        mentionsUnauthorizedAvailability(args.llmReply, toolState) ||
        !args.llmCalledGetAvailability)
    ) {
      forcedReply = buildSlotOfferMessage(slots);
    } else if (gateApplied && slots.length === 0) {
      forcedReply = formatAskPreference(context.firstName);
    }
  }

  if (action.type === "book_appointment") {
    if (!args.llmCalledBookAppointment) {
      gateApplied = true;
      bookingAttempted = true;
      const booked = await runBookAppointment(action.start, context, toolState, now);
      context = booked.context;
      toolState = booked.toolState;

      if (toolState.bookingConfirmed && toolState.bookingStart) {
        forcedReply = buildBookingConfirmationMessage(toolState.bookingStart, context.firstName);
      } else if (toolState.bookingFailed) {
        const refreshInput =
          args.plan.preferenceInput ??
          inferAvailabilityInputFromMessage(args.inboundMessage, now) ??
          defaultAvailabilityInput(now);
        const refreshed = await runGetAvailability(refreshInput, context, toolState, now);
        context = refreshed.context;
        toolState = refreshed.toolState;
        availabilityFetched = true;
        forcedReply = formatConflictReply(toolState.offeredSlots);
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
    const fetched = await runGetAvailability(input, context, toolState, now);
    context = fetched.context;
    toolState = fetched.toolState;
    availabilityFetched = true;
    forcedReply =
      toolState.offeredSlots.length > 0
        ? buildSlotOfferMessage(toolState.offeredSlots)
        : formatAskPreference(context.firstName);
  }

  return {
    context,
    toolState,
    forcedReply,
    gateApplied,
    calendarLinkAllowed,
    availabilityFetched,
    bookingAttempted,
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

  return forcedReply ?? formatAskPreference(args.firstName);
}
