import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { weekdayLabelFromCentralDate } from "~/server/speed2Lead/schedulingRange";
import type { OfferPresentationType } from "~/server/scheduling/types";

function slotLabels(slots: string[]): string[] {
  return slots
    .slice(0, 3)
    .map((slot) => formatTimeOnly(slot, CONSULTATION_TIMEZONE).time);
}

function formatSlotList(labels: string[]): string {
  if (labels.length === 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

/** Deterministic customer-facing slot offer copy from presentation type. */
export function buildSlotOfferCopy(
  slots: string[],
  presentation: OfferPresentationType,
): string {
  const labels = slotLabels(slots);
  if (labels.length === 0) return "";
  const list = formatSlotList(labels);

  switch (presentation) {
    case "repeat_offer":
      return `${list} are still available.`;
    case "changed_offer":
      if (labels.length === 1) return `${labels[0]} is open.`;
      return `${list} are open.`;
    case "first_offer":
    default:
      if (labels.length === 1) return `${labels[0]} is open.`;
      return `${list} are open.`;
  }
}

export function buildNoAvailabilityCopy(hasDate: boolean): string {
  if (hasDate) {
    return "Nothing open in that window — want to try another time that day?";
  }
  return "What day works best for a quick 25-minute chat?";
}

export function buildClosedDayCopy(centralDate: string): string {
  const label = weekdayLabelFromCentralDate(centralDate);
  return `We schedule Monday through Friday, so ${label} isn't open — what weekday works for a quick 25-minute chat?`;
}

export function buildNeedDateCopy(): string {
  return "What day works best for a quick 25-minute chat?";
}

export function buildInternalConstraintCopy(hasDate: boolean): string {
  if (hasDate) {
    return "Let me reset that — what time of day works on that date? Morning or afternoon?";
  }
  return buildNeedDateCopy();
}

export function buildExactUnavailableCopy(slots: string[]): string {
  if (slots.length === 0) {
    return "That exact time isn't open — want to try another time that day?";
  }
  const list = formatSlotList(slotLabels(slots));
  return `That exact time isn't open — closest I have is ${list}.`;
}

export function buildProviderConflictCopy(slots: string[]): string {
  if (slots.length === 0) {
    return "That time just got taken. What day works best for you instead?";
  }
  const list = formatSlotList(slotLabels(slots));
  return `That time just got taken — I still have ${list}.`;
}
