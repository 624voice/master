import { formatTimeOnly } from "~/server/appointmentLifecycle/formatTime";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";

export type SlotOfferSituation =
  | "first_offer"
  | "refinement"
  | "after_rejection"
  | "conflict"
  | "narrowed"
  | "repeat_recovery"
  | "exact_unavailable";

export type SlotOfferContext = {
  slots: string[];
  situation?: SlotOfferSituation;
  /** Stable seed for deterministic phrasing variation (e.g. slot-set key). */
  variationSeed?: string;
};

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

function pickVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length] ?? variants[0]!;
}

/** Deterministic, context-sensitive slot-offer copy — same truth, less repetition. */
export function buildContextualSlotOfferMessage(context: SlotOfferContext): string {
  const labels = slotLabels(context.slots);
  if (labels.length === 0) return "";

  const seed = `${context.variationSeed ?? labels.join("|")}|${context.situation ?? "first_offer"}`;
  const list = formatSlotList(labels);

  if (labels.length === 1) {
    return pickVariant(seed, [
      `I have ${labels[0]} open. Want me to grab it?`,
      `${labels[0]} works on my end — should I book it?`,
    ]);
  }

  if (labels.length === 2) {
    return pickVariant(seed, [
      `${labels[0]} or ${labels[1]} are both open.`,
      `Either ${labels[0]} or ${labels[1]} works.`,
    ]);
  }

  switch (context.situation) {
    case "refinement":
    case "narrowed":
      return pickVariant(seed, [
        `Closer to that, I've got ${list}.`,
        `I've got ${list} around then.`,
      ]);
    case "after_rejection":
      return pickVariant(seed, [
        `Got it — ${list} could work instead.`,
        `How about ${list}?`,
      ]);
    case "conflict":
      return pickVariant(seed, [
        `That time just got taken — I still have ${list}.`,
        `That slot filled up. ${list} are open if either works.`,
      ]);
    case "exact_unavailable":
      return pickVariant(seed, [
        `That exact time isn't open — closest I have is ${list}.`,
        `Not open then, but ${list} could work.`,
      ]);
    case "repeat_recovery":
      return pickVariant(seed, [
        `Still seeing ${list} open.`,
        `${list} are still available.`,
      ]);
    default:
      return pickVariant(seed, [
        `I have ${list}. Any of those work?`,
        `${list} are open — whichever fits best.`,
      ]);
  }
}

/** @deprecated Prefer buildContextualSlotOfferMessage — kept for callers without context. */
export function buildSlotOfferMessage(slots: string[]): string {
  return buildContextualSlotOfferMessage({ slots, situation: "first_offer" });
}
