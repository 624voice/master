import { applySchedulingMeta, normalizeSessionMemory } from "~/server/speed2Lead/memory";
import {
  buildAvailabilityInputFromSchedulingState,
  detectSchedulingConstraints,
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
  mergeSchedulingIntentFromMessage,
  normalizeSchedulingStateConstraints,
  type SchedulingConstraintPatch,
} from "~/server/speed2Lead/schedulingContext";
import {
  detectSemanticDaypartSelection,
  inferAvailabilityInputFromMessage,
  type AvailabilityRangeInput,
} from "~/server/speed2Lead/schedulingRange";
import type { SchedulingPartOfDay, SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type NormalizedSchedulingIntent = {
  centralDate?: string;
  partOfDay?: SchedulingPartOfDay;
  anchorTimeMinutes?: number;
  availabilityInput: AvailabilityRangeInput | null;
  constraintPatch: SchedulingConstraintPatch;
  statePatch: Partial<SchedulingState>;
};

/** Single authoritative extraction pass for all scheduling facts in one inbound. */
export function extractNormalizedSchedulingIntent(args: {
  inboundMessage: string;
  scheduling?: SchedulingState;
  now?: Date;
}): NormalizedSchedulingIntent {
  const now = args.now ?? new Date();
  const scheduling = args.scheduling;
  const constraintPatch = detectSchedulingConstraints(
    args.inboundMessage,
    scheduling,
    scheduling?.offeredSlots ?? [],
  );
  const mergedIntent = mergeSchedulingIntentFromMessage(scheduling, args.inboundMessage, now);
  const semanticPart = detectSemanticDaypartSelection(args.inboundMessage);

  const partOfDay =
    (constraintPatch.partOfDay && constraintPatch.partOfDay !== "full_day"
      ? constraintPatch.partOfDay
      : undefined) ??
    (mergedIntent.partOfDay && mergedIntent.partOfDay !== "full_day"
      ? mergedIntent.partOfDay
      : undefined) ??
    (semanticPart ?? undefined);

  const centralDate = constraintPatch.centralDate ?? mergedIntent.centralDate ?? scheduling?.centralDate;

  const statePatch: Partial<SchedulingState> = {
    ...mergedIntent,
    ...constraintPatch,
    centralDate,
    partOfDay,
    applicationLogicFailure: false,
  };

  const mergedScheduling: SchedulingState = normalizeSchedulingStateConstraints(
    {
      status: scheduling?.status ?? "idle",
      ...scheduling,
      ...statePatch,
    },
    { prior: scheduling },
  );

  const availabilityInput =
    buildAvailabilityInputFromSchedulingState(mergedScheduling, args.inboundMessage, now) ??
    inferAvailabilityInputFromMessage(args.inboundMessage, now);

  const normalizedInput = availabilityInput
    ? {
        ...availabilityInput,
        centralDate: availabilityInput.centralDate ?? mergedScheduling.centralDate,
        partOfDay:
          availabilityInput.partOfDay && availabilityInput.partOfDay !== "full_day"
            ? availabilityInput.partOfDay
            : mergedScheduling.partOfDay && mergedScheduling.partOfDay !== "full_day"
              ? mergedScheduling.partOfDay
              : availabilityInput.partOfDay,
      }
    : null;

  return {
    centralDate: mergedScheduling.centralDate,
    partOfDay: mergedScheduling.partOfDay,
    anchorTimeMinutes: mergedScheduling.anchorTimeMinutes,
    availabilityInput: normalizedInput,
    constraintPatch,
    statePatch: {
      centralDate: mergedScheduling.centralDate,
      partOfDay: mergedScheduling.partOfDay,
      anchorTimeMinutes: mergedScheduling.anchorTimeMinutes,
      rejectedPartOfDay: mergedScheduling.rejectedPartOfDay,
      earliestAllowedMinutes: mergedScheduling.earliestAllowedMinutes,
      latestAllowedMinutes: mergedScheduling.latestAllowedMinutes,
      searchAfterMinutes: mergedScheduling.searchAfterMinutes,
      searchBeforeMinutes: mergedScheduling.searchBeforeMinutes,
      rejectedSlotStarts: mergedScheduling.rejectedSlotStarts,
      applicationLogicFailure: false,
    },
  };
}

/** Merge inbound scheduling facts into session BEFORE gate planning. */
export function prepareInboundSchedulingTurn<T extends AnyConversationContext>(
  context: T,
  inboundMessage: string,
  now = new Date(),
): T {
  const normalized = normalizeSessionMemory(context);
  const prior = normalized.scheduling;
  const intent = extractNormalizedSchedulingIntent({
    inboundMessage,
    scheduling: prior,
    now,
  });

  let updated = applySchedulingMeta(normalized, intent.statePatch);
  const normalizedScheduling = normalizeSchedulingStateConstraints(updated.scheduling, { prior });
  updated = applySchedulingMeta(updated, normalizedScheduling);
  return updated as T;
}

export function schedulingFactsComplete(scheduling?: SchedulingState): boolean {
  return hasKnownSchedulingDay(scheduling) && hasKnownSchedulingPartOfDay(scheduling);
}

export function markApplicationLogicFailure<T extends AnyConversationContext>(context: T): T {
  return applySchedulingMeta(context, { applicationLogicFailure: true }) as T;
}

export function clearApplicationLogicFailure<T extends AnyConversationContext>(context: T): T {
  return applySchedulingMeta(context, { applicationLogicFailure: false }) as T;
}
