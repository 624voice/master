import type { FunctionTool } from "openai/resources/responses/responses";
import { bookConsultation } from "~/server/appointmentLifecycle/bookConsultation";
import { getConsultationSlots } from "~/server/appointmentLifecycle/googleCalendar";
import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  applyConfirmedScheduling,
  applyKnownFactsUpdate,
  applyOfferedSlots,
  normalizeSessionMemory,
} from "~/server/speed2Lead/memory";
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
  bookingStart?: string;
  bookingEventId?: string;
  calendarUnavailable: boolean;
  availabilityAttempts: number;
  bookingAttempts: number;
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

export const ORCHESTRATOR_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "get_availability",
    description:
      "Fetch real consultation slots from Google Calendar for a normalized Central-time range. Only offer slots returned by this tool.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["rangeStart", "rangeEnd", "centralDate", "partOfDay", "maxSlots"],
      properties: {
        rangeStart: {
          type: ["string", "null"],
          description: "ISO8601 range start, or null when using centralDate/partOfDay",
        },
        rangeEnd: {
          type: ["string", "null"],
          description: "ISO8601 range end, or null when using centralDate/partOfDay",
        },
        centralDate: {
          type: ["string", "null"],
          description: "Central date YYYY-MM-DD when using partOfDay instead of explicit ISO range",
        },
        partOfDay: {
          type: ["string", "null"],
          enum: ["morning", "afternoon", "evening", "full_day", null],
        },
        maxSlots: {
          type: ["number", "null"],
          description: "Maximum slots to return, default 3",
        },
      },
    },
  },
  {
    type: "function",
    name: "book_appointment",
    description:
      "Book a consultation at a slot previously returned by get_availability. Only call after the customer selects a valid offered slot.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["start", "notes"],
      properties: {
        start: { type: "string", description: "ISO8601 start time from offered slots" },
        notes: { type: ["string", "null"] },
      },
    },
  },
  {
    type: "function",
    name: "update_known_facts",
    description:
      "Persist structured lead facts discovered in conversation. Do not store arbitrary session fields.",
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
          description: "Set true only when this turn asks one genuine discovery question",
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
    maxSlots,
    now,
  });

  state = { ...state, availabilityAttempts: state.availabilityAttempts + 1 };

  if (!availability.ok) {
    state = { ...state, calendarUnavailable: availability.reason === "not_configured" };
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

  const offered = availability.slots.slice(0, maxSlots);
  state = { ...state, offeredSlots: offered, calendarUnavailable: offered.length === 0 };

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
  if (!start) {
    return {
      result: { ok: false, reason: "missing_start" },
      context,
      state: { ...state, bookingAttempts: state.bookingAttempts + 1 },
    };
  }

  if (state.offeredSlots.length > 0 && !slotIsOffered(start, state.offeredSlots)) {
    return {
      result: { ok: false, reason: "slot_not_offered" },
      context,
      state: { ...state, bookingAttempts: state.bookingAttempts + 1 },
    };
  }

  const normalized = normalizeSessionMemory(context);
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
      state = { ...state, calendarUnavailable: true };
    }
    return {
      result: {
        ok: false,
        reason: booked.reason,
        detail: booked.detail,
        fallback: booked.reason === "slot_unavailable" ? "offer_alternatives" : "calendar_link",
      },
      context,
      state: { ...state, bookingFailed: true },
    };
  }

  state = {
    ...state,
    bookingConfirmed: true,
    bookingStart: booked.selectedStart,
    bookingEventId: booked.eventId,
  };

  let updated = applyConfirmedScheduling(normalized, {
    selectedStart: booked.selectedStart,
    calendarEventId: booked.eventId,
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
  return (
    state.calendarUnavailable ||
    state.availabilityAttempts >= 2 ||
    state.bookingAttempts >= 2
  );
}
