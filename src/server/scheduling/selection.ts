import { slotStartMinutes } from "~/server/scheduling/filterRank";
import { parseFlexibleTimeToken } from "~/server/speed2Lead/schedulingContext";

const ORDINAL_RE =
  /\b(first|1st|second|2nd|third|3rd|fourth|4th|last|that\s+one|this\s+one)\b/i;

const SELECTION_AFFIRMATIVE_RE =
  /\b(works?|good|perfect|sounds\s+good|book|take|grab|yes|yeah|yep|sure|ok(?:ay)?|that\s+one|this\s+one|i'?ll\s+take|lets?\s+do)\b/i;

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

function extractSelectionMinutes(message: string, offeredSlots: string[]): number | null {
  const patterns = [
    /\b(?:let'?s\s+do|lets?\s+do|take|book|do|sure|yes|yeah|yep|ok(?:ay)?)\s+(\d{1,2})(?::(\d{2}))?\b/i,
    /\b(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*(?:works?|good|perfect|fine|ok(?:ay)?)\b/i,
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const raw = match[2] ? `${match[1]}:${match[2]}` : match[1];
    const parsed = parseFlexibleTimeToken(raw.replace(/\s+/g, ""));
    if (parsed != null && !Number.isNaN(parsed)) return parsed;
  }
  return null;
}

export function slotMatchesMinutes(iso: string, minutes: number, tolerance = 0): boolean {
  const slotMinutes = slotStartMinutes(iso);
  if (slotMinutes === null) return false;
  return Math.abs(slotMinutes - minutes) <= tolerance;
}

export function resolveOfferedSlotSelection(
  message: string,
  offeredSlots: string[],
): string | null {
  if (offeredSlots.length === 0) return null;

  const ordinal = resolveOrdinalIndex(message, offeredSlots.length);
  if (ordinal != null && offeredSlots[ordinal]) {
    return offeredSlots[ordinal]!;
  }

  const requestedMinutes = extractSelectionMinutes(message, offeredSlots);
  if (requestedMinutes != null) {
    const matches = offeredSlots.filter((slot) =>
      slotMatchesMinutes(slot, requestedMinutes, 30),
    );
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      matches.sort(
        (a, b) =>
          Math.abs((slotStartMinutes(a) ?? 0) - requestedMinutes) -
          Math.abs((slotStartMinutes(b) ?? 0) - requestedMinutes),
      );
      return matches[0] ?? null;
    }
  }

  if (SELECTION_AFFIRMATIVE_RE.test(message) && ORDINAL_RE.test(message)) {
    return resolveOfferedSlotSelection(message.replace(ORDINAL_RE, "first"), offeredSlots);
  }

  return null;
}

export function looksLikeSlotSelection(message: string, offeredSlots: string[]): boolean {
  if (offeredSlots.length === 0) return false;
  return resolveOfferedSlotSelection(message, offeredSlots) != null;
}

export function looksLikeExactTimeProposal(message: string): boolean {
  return /\b(?:how\s+about|what\s+about|around|at|about|let'?s\s+do|lets?\s+do)\s+\d/i.test(
    message,
  ) || /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(message);
}
