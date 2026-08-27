import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { formatNaturalAppointmentParts, formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { buildSlotOfferCopy } from "~/server/scheduling/copy";
import { weekdayLabelFromCentralDate } from "~/server/speed2Lead/schedulingRange";
import type { ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type SchedulingCustomerQuestionKind =
  | "date_confirm"
  | "what_time"
  | "confirm_now"
  | "meet_link"
  | "none";

const DATE_CONFIRM_RE =
  /\b(?:we(?:'re| are)\s+(?:talking|looking)\s+(?:about|at)|(?:that|the)\s+(?:is|was)\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+right|\s+correct|\s+still|\?)/i;

const WHAT_TIME_RE = /^\s*what\s+time\s*\??\s*$/i;

const CONFIRM_NOW_RE =
  /\b(can you confirm|confirm it now|did you book|is it booked|are we booked|is that booked)\b/i;

const MEET_LINK_RE =
  /\b(meeting link|meet link|google meet|zoom link|video link|join link|call link)\b/i;

function centralDateFromContext(context: AnyConversationContext): string | undefined {
  return context.scheduling?.requestedDate ?? context.scheduling?.centralDate;
}

function ordinalDayFromMessage(message: string): number | null {
  const match = message.match(DATE_CONFIRM_RE);
  if (!match?.[1]) return null;
  const day = Number.parseInt(match[1], 10);
  return day >= 1 && day <= 31 ? day : null;
}

function dayMatchesCentralDate(centralDate: string, day: number): boolean {
  const parts = centralDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return false;
  return Number.parseInt(parts[3] ?? "0", 10) === day;
}

/** Detect scheduling clarification questions that must be answered without a provider query. */
export function detectSchedulingCustomerQuestion(
  message: string,
  context: AnyConversationContext,
): SchedulingCustomerQuestionKind {
  const trimmed = message.trim();
  if (!trimmed) return "none";

  if (context.scheduling?.status === "confirmed") {
    if (MEET_LINK_RE.test(trimmed)) return "meet_link";
    if (WHAT_TIME_RE.test(trimmed) || CONFIRM_NOW_RE.test(trimmed)) {
      return context.scheduling.selectedStart ? "what_time" : "confirm_now";
    }
  }

  const centralDate = centralDateFromContext(context);
  const day = ordinalDayFromMessage(trimmed);
  if (day != null && /\?\s*$/.test(trimmed) && (centralDate || /\b(?:talking|looking|about)\b/i.test(trimmed))) {
    return "date_confirm";
  }

  if (WHAT_TIME_RE.test(trimmed)) {
    if (context.scheduling?.status === "confirmed" && context.scheduling.selectedStart) {
      return "what_time";
    }
    if ((context.scheduling?.offeredSlots?.length ?? 0) > 0) {
      return "what_time";
    }
  }

  if (CONFIRM_NOW_RE.test(trimmed)) {
    return context.scheduling?.status === "confirmed" ? "what_time" : "confirm_now";
  }

  if (MEET_LINK_RE.test(trimmed) && context.scheduling?.status === "confirmed") {
    return "meet_link";
  }

  return "none";
}

export function isSchedulingCustomerQuestion(kind: SchedulingCustomerQuestionKind): boolean {
  return kind !== "none";
}

function formatBookedTimeReply(selectedStart: string): string {
  const { weekday, month, day, time, timezoneShort } = formatNaturalAppointmentParts(
    selectedStart,
    CONSULTATION_TIMEZONE,
  );
  const tz = timezoneShort ? ` ${timezoneShort}` : "";
  return `${weekday}, ${month} ${day} at ${time}${tz}.`;
}

/** Deterministic reply for scheduling clarification — preserves underlying scheduling state. */
export function buildSchedulingCustomerQuestionReply(args: {
  kind: SchedulingCustomerQuestionKind;
  context: AnyConversationContext;
  toolState: ToolExecutionState;
  inboundMessage: string;
}): string | null {
  const { kind, context, toolState, inboundMessage } = args;
  if (kind === "none") return null;

  const centralDate = centralDateFromContext(context);
  const offered = toolState.offeredSlots.length > 0
    ? toolState.offeredSlots
    : (context.scheduling?.offeredSlots ?? []);

  if (kind === "date_confirm") {
    const day = ordinalDayFromMessage(inboundMessage);
    if (day == null) return null;
    if (centralDate && dayMatchesCentralDate(centralDate, day)) {
      const label = weekdayLabelFromCentralDate(centralDate);
      return `Yes — ${label} the ${day}${ordinalSuffix(day)}.`;
    }
    if (centralDate) {
      const parts = centralDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const actualDay = parts ? Number.parseInt(parts[3] ?? "0", 10) : null;
      if (actualDay != null) {
        const label = weekdayLabelFromCentralDate(centralDate);
        return `Actually — ${label} the ${actualDay}${ordinalSuffix(actualDay)}.`;
      }
    }
    return null;
  }

  if (kind === "what_time") {
    if (context.scheduling?.status === "confirmed" && context.scheduling.selectedStart) {
      return formatBookedTimeReply(context.scheduling.selectedStart);
    }
    if (offered.length > 0) {
      return buildSlotOfferCopy(offered, "repeat_offer");
    }
    if (centralDate && context.scheduling?.partOfDay && context.scheduling.partOfDay !== "full_day") {
      const label = weekdayLabelFromCentralDate(centralDate);
      return `Still on ${label} ${context.scheduling.partOfDay} — which time works from what I sent?`;
    }
    return null;
  }

  if (kind === "confirm_now") {
    if (context.scheduling?.status === "confirmed" && context.scheduling.selectedStart) {
      return `Yes — we're booked for ${formatBookedTimeReply(context.scheduling.selectedStart)}`;
    }
    if (offered.length > 0) {
      return `Not booked yet — ${buildSlotOfferCopy(offered, "repeat_offer")}`;
    }
    return "Not booked yet — pick a time from what's open and I'll lock it in.";
  }

  if (kind === "meet_link") {
    const link = context.scheduling?.googleMeetUrl;
    if (link) {
      return `Here's the Google Meet link: ${link}`;
    }
    return "The Meet link is created when we book a specific time — let's finish picking one.";
  }

  return null;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
