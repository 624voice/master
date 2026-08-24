import type { FunctionTool } from "openai/resources/responses/responses";
import { bookConsultation } from "~/server/appointmentLifecycle/bookConsultation";
import { getConsultationSlots } from "~/server/appointmentLifecycle/googleCalendar";
import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { logBookingTelemetry } from "~/server/speed2Lead/bookingTelemetry";
import {
  applyConfirmedScheduling,
  applyKnownFactsUpdate,
  applyOfferedSlots,
  normalizeSessionMemory,
} from "~/server/speed2Lead/memory";
import {
  buildSlotRankPreferencesFromState,
  filterSlotsForSchedulingState,
} from "~/server/speed2Lead/schedulingContext";
import {
  rankSlotsForOffer,
} from "~/server/speed2Lead/slotRanking";
import {
  resolveAvailabilityRange,
  type AvailabilityRangeInput,
} from "~/server/speed2Lead/schedulingRange";
import type { KnownFactsFit, KnownFactsUrgency } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import type { S2LSource } from "~/server/appointmentLifecycle/types";

export type ToolExecutionState = {
  offeredSlots: string[];
  bookingConfirmed: boolean;
  bookingFailed: boolean;
  lastBookingFailureReason?:
    | "provider_conflict"
    | "invalid_selection"
    | "provider_error"
    | "missing_start";
  bookingStart?: string;
  bookingEventId?: string;
  calendarUnavailable: boolean;
  providerFailureReason?: string;
  availabilityAttempts: number;
  bookingAttempts: number;
  lifecycleConfirmationSent?: boolean;
};

export function createInitialToolState(): ToolExecutionState {
  return {
    offeredSlots: [],
    bookingConfirmed: false,
    bookingFailed: false,
    calendarUnavailable: false,
    availabilityAttempts: 0,
    bookingAttempts: 0,
  };
}

/** LLM may update optional enrichment facts only — scheduling truth is code-owned. */
export const ORCHESTRATOR_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "update_known_facts",
    description:
      "Persist optional structured lead facts discovered in conversation. Stage progression is code-owned.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "primaryPain",
        "urgency",
        "fit",
        "objection",
        "customerGoal",
        "discoveryQuestionAsked",
      ],
      properties: {
        primaryPain: { type: ["string", "null"] },
        urgency: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
        fit: { type: ["string", "null"], enum: ["yes", "maybe", "no", null] },
        objection: { type: ["string", "null"] },
        customerGoal: { type: ["string", "null"] },
        discoveryQuestionAsked: {
          type: ["boolean", "null"],
          description: "Deprecated — discovery count is code-owned",
        },
      },
    },
  },
];

function resolveSource(context: AnyConversationContext): S2LSource {
  if (context.flow === "contact") return "contact";
  if (context.flow === "demo") return "demo";
  return "roi";
}

function attendeeName(context: AnyConversationContext): string {
  if (context.flow === "demo") {
    return `${context.firstName} ${context.lastName}`.trim();
  }
  return context.firstName;
}

function formatSlotsForModel(slots: string[]): Array<{ start: string; label: string }> {
  return slots.map((start) => {
    const { time, timezoneShort } = formatTimeOnly(start, CONSULTATION_TIMEZONE);
    return {
      start,
      label: timezoneShort ? `${time} ${timezoneShort}` : time,
    };
  });
}

function slotIsOffered(start: string, offeredSlots: string[]): boolean {
  const target = new Date(start).getTime();
  return offeredSlots.some((slot) => new Date(slot).getTime() === target);
}

async function handleGetAvailability(
  args: Record<string, unknown>,
  context: AnyConversationContext,
  state: ToolExecutionState,
  now: Date,
): Promise<{ result: unknown; context: AnyConversationContext; state: ToolExecutionState }> {
  const rangeInput: AvailabilityRangeInput = {
    rangeStart: typeof args.rangeStart === "string" ? args.rangeStart : undefined,
    rangeEnd: typeof args.rangeEnd === "string" ? args.rangeEnd : undefined,
    centralDate: typeof args.centralDate === "string" ? args.centralDate : undefined,
    partOfDay:
      args.partOfDay === "morning" ||
      args.partOfDay === "afternoon" ||
      args.partOfDay === "evening" ||
      args.partOfDay === "full_day"
        ? args.partOfDay
        : undefined,
  };

  const resolved = resolveAvailabilityRange(rangeInput, now);
  if ("error" in resolved) {
    return {
      result: { ok: false, reason: resolved.error },
      context,
      state: { ...state, availabilityAttempts: state.availabilityAttempts + 1 },
    };
  }

  const maxSlots =
    typeof args.maxSlots === "number" && args.maxSlots > 0 ? Math.min(args.maxSlots, 3) : 3;

  const availability = await getConsultationSlots({
    rangeStart: resolved.rangeStart,
    rangeEnd: resolved.rangeEnd,
    maxSlots: 48,
    now,
  });

  if (!availability.ok) {
    state = {
      ...state,
      calendarUnavailable:
        availability.reason === "not_configured" ||
        availability.reason === "calendar_api_error",
      providerFailureReason: availability.reason,
      availabilityAttempts: state.availabilityAttempts + 1,
    };
    return {
      result: {
        ok: false,
        reason: availability.reason,
        detail: availability.detail,
        fallback: "calendar_link",
      },
      context,
      state,
    };
  }

  const rankPreferences = buildSlotRankPreferencesFromState(context.scheduling, rangeInput);
  const mergedScheduling = {
    ...context.scheduling,
    centralDate: rangeInput.centralDate ?? context.scheduling?.centralDate,
    partOfDay: rangeInput.partOfDay ?? context.scheduling?.partOfDay,
  };
  let offered = rankSlotsForOffer(availability.slots, {
    ...rankPreferences,
    maxOffer: maxSlots,
  });
  offered = filterSlotsForSchedulingState(offered, mergedScheduling);
  state = {
    ...state,
    offeredSlots: offered,
    availabilityAttempts: offered.length > 0 ? 0 : state.availabilityAttempts + 1,
  };

  return {
    result: {
      ok: true,
      slots: formatSlotsForModel(offered),
      rangeStart: resolved.rangeStart.toISOString(),
      rangeEnd: resolved.rangeEnd.toISOString(),
    },
    context: applyOfferedSlots(context, offered),
    state,
  };
}

async function handleBookAppointment(
  args: Record<string, unknown>,
  context: AnyConversationContext,
  state: ToolExecutionState,
  now: Date,
): Promise<{ result: unknown; context: AnyConversationContext; state: ToolExecutionState }> {
  const start = typeof args.start === "string" ? args.start : "";
  const phoneSuffix = context.phone.slice(-4);
  logBookingTelemetry({
    stage: "interpretation",
    outcome: start ? "success" : "failure",
    reason: start ? undefined : "missing_start",
    slotStart: start || undefined,
    phoneSuffix,
  });

  if (!start) {
    return {
      result: { ok: false, reason: "missing_start" },
      context,
      state: { ...state, bookingAttempts: state.bookingAttempts + 1, lastBookingFailureReason: "missing_start" },
    };
  }

  if (state.offeredSlots.length > 0 && !slotIsOffered(start, state.offeredSlots)) {
    logBookingTelemetry({
      stage: "slot_state",
      outcome: "failure",
      reason: "slot_not_offered",
      slotStart: start,
      phoneSuffix,
    });
    return {
      result: { ok: false, reason: "slot_not_offered", failureType: "invalid_selection" },
      context,
      state: {
        ...state,
        bookingAttempts: state.bookingAttempts + 1,
        lastBookingFailureReason: "invalid_selection",
        bookingFailed: false,
      },
    };
  }

  const normalized = normalizeSessionMemory(context);
  logBookingTelemetry({
    stage: "recheck",
    outcome: "started",
    slotStart: start,
    requestKey: normalized.scheduling?.activeRequestKey,
    phoneSuffix,
  });

  const booked = await bookConsultation({
    start,
    attendeeName: attendeeName(normalized),
    attendeeEmail: normalized.knownFacts.email ?? ("email" in normalized ? normalized.email : undefined),
    phone: normalized.phone,
    businessName: normalized.knownFacts.businessName,
    source: resolveSource(normalized),
    notes: typeof args.notes === "string" ? args.notes : undefined,
    now,
  });

  state = { ...state, bookingAttempts: state.bookingAttempts + 1 };

  if (!booked.ok) {
    if (booked.reason === "not_configured" || booked.reason === "calendar_api_error") {
      state = { ...state, calendarUnavailable: true, providerFailureReason: booked.reason };
    }
    const failureType =
      booked.reason === "slot_unavailable" ? "provider_conflict" : "provider_error";
    logBookingTelemetry({
      stage: "create_event",
      outcome: "failure",
      reason: booked.reason,
      slotStart: start,
      phoneSuffix,
    });
    return {
      result: {
        ok: false,
        reason: booked.reason,
        detail: booked.detail,
        failureType,
        fallback: booked.reason === "slot_unavailable" ? "offer_alternatives" : "calendar_link",
      },
      context,
      state: {
        ...state,
        bookingFailed: booked.reason === "slot_unavailable",
        lastBookingFailureReason: failureType,
      },
    };
  }

  if (!booked.eventId) {
    logBookingTelemetry({
      stage: "create_event",
      outcome: "failure",
      reason: "missing_event_id",
      slotStart: start,
      phoneSuffix,
    });
    return {
      result: { ok: false, reason: "missing_event_id", failureType: "provider_error" },
      context,
      state: {
        ...state,
        bookingFailed: false,
        lastBookingFailureReason: "provider_error",
      },
    };
  }

  logBookingTelemetry({
    stage: "create_event",
    outcome: "success",
    slotStart: booked.selectedStart,
    eventId: booked.eventId,
    phoneSuffix,
  });

  state = {
    ...state,
    bookingConfirmed: true,
    bookingStart: booked.selectedStart,
    bookingEventId: booked.eventId,
    lifecycleConfirmationSent: booked.lifecycle.smsSent === true,
  };

  let updated = applyConfirmedScheduling(normalized, {
    selectedStart: booked.selectedStart,
    calendarEventId: booked.eventId,
  });

  logBookingTelemetry({
    stage: "persistence",
    outcome: "success",
    slotStart: booked.selectedStart,
    eventId: booked.eventId,
    phoneSuffix,
  });

  if (updated.flow === "demo") {
    updated = { ...updated, meetingBooked: true, state: "completed" };
  } else if ("state" in updated) {
    updated = { ...updated, state: "completed" };
  }

  return {
    result: {
      ok: true,
      eventId: booked.eventId,
      start: booked.selectedStart,
      replayed: booked.replayed,
    },
    context: updated,
    state,
  };
}

function handleUpdateKnownFacts(
  args: Record<string, unknown>,
  context: AnyConversationContext,
  state: ToolExecutionState,
): { result: unknown; context: AnyConversationContext; state: ToolExecutionState } {
  const updated = applyKnownFactsUpdate(context, {
    primaryPain: typeof args.primaryPain === "string" ? args.primaryPain : undefined,
    urgency:
      args.urgency === "low" || args.urgency === "medium" || args.urgency === "high"
        ? (args.urgency as KnownFactsUrgency)
        : undefined,
    fit:
      args.fit === "yes" || args.fit === "maybe" || args.fit === "no"
        ? (args.fit as KnownFactsFit)
        : undefined,
    objection: typeof args.objection === "string" ? args.objection : undefined,
    customerGoal: typeof args.customerGoal === "string" ? args.customerGoal : undefined,
    discoveryQuestionAsked: args.discoveryQuestionAsked === true,
  });

  return {
    result: { ok: true, knownFacts: updated.knownFacts },
    context: updated,
    state,
  };
}

export async function executeOrchestratorTool(
  name: string,
  args: Record<string, unknown>,
  context: AnyConversationContext,
  state: ToolExecutionState,
  now = new Date(),
): Promise<{ result: unknown; context: AnyConversationContext; state: ToolExecutionState }> {
  switch (name) {
    case "get_availability":
      return handleGetAvailability(args, context, state, now);
    case "book_appointment":
      return handleBookAppointment(args, context, state, now);
    case "update_known_facts":
      return handleUpdateKnownFacts(args, context, state);
    default:
      return {
        result: { ok: false, reason: "unknown_tool" },
        context,
        state,
      };
  }
}

export function shouldSuggestCalendarLink(state: ToolExecutionState): boolean {
  if (state.availabilityAttempts >= 2 && state.offeredSlots.length === 0) {
    return true;
  }
  if (
    state.bookingAttempts >= 2 &&
    state.offeredSlots.length === 0 &&
    !state.bookingConfirmed
  ) {
    return true;
  }
  return false;
}
