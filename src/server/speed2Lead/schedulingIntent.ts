import { applySchedulingMeta, normalizeSessionMemory } from "~/server/speed2Lead/memory";
import {
  mergeIntentIntoState,
  parseSchedulingIntentUpdate,
} from "~/server/scheduling/intentParser";
import { fromCanonicalSchedulingState, toCanonicalSchedulingState } from "~/server/scheduling/state";
import type { SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

/** Merge inbound scheduling facts into session BEFORE gate planning. */
export function prepareInboundSchedulingTurn<T extends AnyConversationContext>(
  context: T,
  inboundMessage: string,
  now = new Date(),
): T {
  const normalized = normalizeSessionMemory(context);
  const canonical = toCanonicalSchedulingState(normalized.scheduling);
  const patch = parseSchedulingIntentUpdate(inboundMessage, canonical, now);
  const merged = mergeIntentIntoState(canonical, patch);
  const scheduling = fromCanonicalSchedulingState(merged);
  return applySchedulingMeta(normalized, scheduling) as T;
}

export function schedulingFactsComplete(scheduling?: SchedulingState): boolean {
  if (!scheduling) return false;
  const date = scheduling.requestedDate ?? scheduling.centralDate;
  if (!date) return false;
  if (scheduling.availabilityPreference === "earliest") return true;
  if (scheduling.availabilityPreference === "full_day") return true;
  if (
    scheduling.availabilityPreference === "morning" ||
    scheduling.availabilityPreference === "afternoon" ||
    scheduling.availabilityPreference === "evening" ||
    scheduling.availabilityPreference === "exact_time"
  ) {
    return true;
  }
  if (scheduling.exactTimeMinutes != null) return true;
  if (scheduling.partOfDay && scheduling.partOfDay !== "full_day") return true;
  return false;
}

export function markApplicationLogicFailure<T extends AnyConversationContext>(context: T): T {
  return applySchedulingMeta(context, { applicationLogicFailure: true }) as T;
}

export function clearApplicationLogicFailure<T extends AnyConversationContext>(context: T): T {
  return applySchedulingMeta(context, { applicationLogicFailure: false }) as T;
}

/** Merge inbound scheduling language into legacy scheduling state shape. */
export function extractNormalizedSchedulingIntent(args: {
  inboundMessage: string;
  scheduling?: SchedulingState;
  now?: Date;
}): Partial<SchedulingState> {
  const canonical = toCanonicalSchedulingState(args.scheduling);
  const patch = parseSchedulingIntentUpdate(
    args.inboundMessage,
    canonical,
    args.now ?? new Date(),
  );
  const merged = mergeIntentIntoState(canonical, patch);
  return fromCanonicalSchedulingState(merged);
}
