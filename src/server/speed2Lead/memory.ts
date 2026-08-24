import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";
import { analyzeMessage, primaryPainLabel } from "~/server/speed2Lead/naturalLanguage";
import { normalizeDiscoveryFacts, simplePainLabel } from "~/server/speed2Lead/discoveryProgress";
import { shouldPreserveCustomerGoal } from "~/server/speed2Lead/turnSemantics";
import type { TurnSemantics } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AvailabilityRangeInput } from "~/server/speed2Lead/schedulingRange";
import {
  earliestOfferedMinutes,
  latestOfferedMinutes,
} from "~/server/speed2Lead/slotRanking";
import {
  filterSlotsForSchedulingState,
  normalizeSchedulingStateConstraints,
  offeredSlotConstraintKey,
} from "~/server/speed2Lead/schedulingContext";
import type {
  ConversationMessage,
  ConversationMessageRole,
  KnownFacts,
  SchedulingPartOfDay,
  SchedulingState,
  SessionMemoryFields,
} from "~/server/speed2Lead/sessionMemoryTypes";
import { MAX_CONVERSATION_MESSAGES } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

export {
  MAX_CONVERSATION_MESSAGES,
  type ConversationMessage,
  type ConversationMessageRole,
  type KnownFacts,
  type KnownFactsFit,
  type KnownFactsFlow,
  type KnownFactsUrgency,
  type SchedulingState,
  type SchedulingStatus,
  type SessionMemoryFields,
} from "~/server/speed2Lead/sessionMemoryTypes";

export function createEmptyScheduling(): SchedulingState {
  return { status: "idle" };
}

export function createInitialMemory(
  context: AnyConversationContext,
): Required<Pick<SessionMemoryFields, "messages" | "knownFacts" | "scheduling">> {
  return {
    messages: [],
    knownFacts: seedKnownFacts(context),
    scheduling: createEmptyScheduling(),
  };
}

function resolveFlow(context: AnyConversationContext): KnownFactsFlow {
  if (context.flow === "contact") return "contact";
  if (context.flow === "demo") return "demo";
  return "roi";
}

export function seedKnownFacts(context: AnyConversationContext): KnownFacts {
  const flow = resolveFlow(context);
  const base: KnownFacts = normalizeDiscoveryFacts({
    firstName: context.firstName,
    phone: normalizePhone(context.phone),
    flow,
    questionsAsked: 0,
    discoveryPhase: "awaiting_report_reaction",
  });

  if (context.flow === "contact") {
    const contact = context as AnyConversationContext & {
      businessName: string;
      shortNeedSummary: string;
    };
    return {
      ...base,
      businessName: contact.businessName,
      customerGoal: contact.shortNeedSummary,
    };
  }

  if (context.flow === "demo") {
    const demo = context as AnyConversationContext & {
      email: string;
      businessName?: string;
    };
    return {
      ...base,
      email: demo.email,
      businessName: demo.businessName,
    };
  }

  const roi = context as AnyConversationContext & {
    businessName: string;
    primaryOpportunity: string;
    annualOpportunity?: string;
    trade?: string;
    truckCount?: number;
    monthlyCalls?: number;
    email?: string;
  };
  return {
    ...base,
    businessName: roi.businessName,
    customerGoal: roi.primaryOpportunity,
    annualOpportunity: roi.annualOpportunity,
    trade: roi.trade,
    truckCount: roi.truckCount,
    monthlyCalls: roi.monthlyCalls,
    email: roi.email ?? base.email,
  };
}

export function syncKnownFactsFromDetections(
  context: AnyConversationContext,
  knownFacts: KnownFacts,
  semantics?: TurnSemantics,
): KnownFacts {
  let updated = normalizeDiscoveryFacts(knownFacts);

  if (context.lastCustomerMessage?.trim()) {
    const signals = analyzeMessage(context.lastCustomerMessage);
    const mayPersistPain =
      !semantics || semantics.kind === "substantive_answer" || semantics.kind === "correction";
    if (signals.pains.length > 0 && mayPersistPain) {
      updated = {
        ...updated,
        primaryPain: simplePainLabel(signals.pains as PainCategory[]),
      };
    }
  }

  if (context.detectedPains && context.detectedPains.length > 0) {
    updated = {
      ...updated,
      primaryPain: primaryPainLabel(context.detectedPains as PainCategory[]),
    };
  }

  if (
    context.lastCustomerMessage?.trim() &&
    (!semantics || shouldPreserveCustomerGoal(semantics)) &&
    context.flow !== "roi"
  ) {
    updated = {
      ...updated,
      customerGoal: context.lastCustomerMessage.trim(),
    };
  }

  if (context.flow === "contact") {
    const contact = context as AnyConversationContext & { shortNeedSummary: string };
    if (!updated.customerGoal) {
      updated = { ...updated, customerGoal: contact.shortNeedSummary };
    }
  }

  if (context.flow === "demo") {
    const demo = context as AnyConversationContext & {
      meetingBooked?: boolean;
      customerDeclined?: boolean;
    };
    if (demo.meetingBooked) {
      updated = { ...updated, fit: "yes" };
    } else if (demo.customerDeclined) {
      updated = { ...updated, fit: "no" };
    }
  }

  return updated;
}

function capMessages(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) {
    return messages;
  }
  return messages.slice(messages.length - MAX_CONVERSATION_MESSAGES);
}

function isDuplicateTail(
  messages: ConversationMessage[],
  role: ConversationMessageRole,
  content: string,
): boolean {
  const last = messages[messages.length - 1];
  return last?.role === role && last.content === content.trim();
}

export function appendUserMessage<T extends AnyConversationContext>(
  context: T,
  content: string,
  at = new Date().toISOString(),
): T {
  const trimmed = content.trim();
  if (!trimmed) {
    return context;
  }

  const normalized = normalizeSessionMemory(context);
  if (isDuplicateTail(normalized.messages, "user", trimmed)) {
    return normalized as T;
  }

  const messages = capMessages([
    ...normalized.messages,
    { role: "user", content: trimmed, at },
  ]);

  const withMessages = {
    ...normalized,
    messages,
    lastCustomerMessage: trimmed,
    updatedAt: at,
  };

  return {
    ...withMessages,
    knownFacts: syncKnownFactsFromDetections(withMessages, withMessages.knownFacts, withMessages.lastTurnSemantics),
  } as T;
}

export function appendAssistantMessage<T extends AnyConversationContext>(
  context: T,
  content: string,
  at = new Date().toISOString(),
): T {
  const trimmed = content.trim();
  if (!trimmed) {
    return context;
  }

  const normalized = normalizeSessionMemory(context);
  if (isDuplicateTail(normalized.messages, "assistant", trimmed)) {
    return normalized as T;
  }

  const messages = capMessages([
    ...normalized.messages,
    { role: "assistant", content: trimmed, at },
  ]);

  const withMessages = {
    ...normalized,
    messages,
    updatedAt: at,
  };

  return {
    ...withMessages,
    knownFacts: syncKnownFactsFromDetections(withMessages, withMessages.knownFacts, withMessages.lastTurnSemantics),
  } as T;
}

export function normalizeSessionMemory<T extends AnyConversationContext>(
  context: T,
): T & Required<SessionMemoryFields> {
  const initial = createInitialMemory(context);
  const messages = context.messages ?? initial.messages;
  const scheduling = {
    ...initial.scheduling,
    ...context.scheduling,
  };
  const knownFacts = syncKnownFactsFromDetections(context, {
    ...initial.knownFacts,
    ...context.knownFacts,
  }, context.lastTurnSemantics);

  return {
    ...context,
    messages: capMessages(messages),
    knownFacts,
    scheduling,
  } as T & Required<SessionMemoryFields>;
}

export function prepareSessionForSave<T extends AnyConversationContext>(
  context: T,
): T & Required<SessionMemoryFields> {
  return normalizeSessionMemory(context);
}

export function applyConfirmedScheduling<T extends AnyConversationContext>(
  context: T,
  booking: { selectedStart: string; calendarEventId: string },
): T {
  const normalized = normalizeSessionMemory(context);
  return {
    ...normalized,
    disposition: "booked",
    scheduling: {
      ...normalized.scheduling,
      status: "confirmed",
      selectedStart: booking.selectedStart,
      calendarEventId: booking.calendarEventId,
      bookingPending: false,
      offeredSlots: undefined,
    },
    updatedAt: new Date().toISOString(),
  } as T;
}

export type KnownFactsUpdateInput = Partial<
  Pick<KnownFacts, "primaryPain" | "urgency" | "fit" | "objection" | "customerGoal">
> & {
  discoveryQuestionAsked?: boolean;
};

export function applyKnownFactsUpdate<T extends AnyConversationContext>(
  context: T,
  update: KnownFactsUpdateInput,
): T {
  const normalized = normalizeSessionMemory(context);
  const { discoveryQuestionAsked: _ignored, ...factsPatch } = update;

  return {
    ...normalized,
    knownFacts: normalizeDiscoveryFacts({
      ...normalized.knownFacts,
      ...factsPatch,
    }),
    updatedAt: new Date().toISOString(),
  } as T;
}

export function invalidateIncompatibleOfferedSlots<T extends AnyConversationContext>(
  context: T,
): T {
  const normalized = normalizeSessionMemory(context);
  const scheduling = normalized.scheduling;
  const offered = scheduling.offeredSlots ?? [];
  if (offered.length === 0) {
    return normalized as T;
  }

  const compatible = filterSlotsForSchedulingState(offered, scheduling);
  if (compatible.length === offered.length) {
    return normalized as T;
  }

  if (compatible.length === 0) {
    return {
      ...normalized,
      scheduling: {
        ...scheduling,
        status: "idle",
        offeredSlots: undefined,
        lastOfferedSlotKey: undefined,
        lastOfferedEarliestMinutes: undefined,
        lastOfferedLatestMinutes: undefined,
      },
      updatedAt: new Date().toISOString(),
    } as T;
  }

  return applyOfferedSlots(normalized as T, compatible);
}

function constraintsMateriallyChanged(
  scheduling: SchedulingState,
  patch: Partial<SchedulingState>,
): boolean {
  if (patch.centralDate && patch.centralDate !== scheduling.centralDate) return true;
  if (patch.partOfDay && patch.partOfDay !== scheduling.partOfDay) return true;
  if (
    patch.earliestAllowedMinutes != null &&
    patch.earliestAllowedMinutes !== scheduling.earliestAllowedMinutes
  ) {
    return true;
  }
  if (
    patch.latestAllowedMinutes != null &&
    patch.latestAllowedMinutes !== scheduling.latestAllowedMinutes
  ) {
    return true;
  }
  if (patch.anchorTimeMinutes != null && patch.anchorTimeMinutes !== scheduling.anchorTimeMinutes) {
    return true;
  }
  if (patch.searchAfterMinutes != null && patch.searchAfterMinutes !== scheduling.searchAfterMinutes) {
    return true;
  }
  if (
    patch.searchBeforeMinutes != null &&
    patch.searchBeforeMinutes !== scheduling.searchBeforeMinutes
  ) {
    return true;
  }
  if (patch.rejectedPartOfDay && patch.rejectedPartOfDay.length > 0) return true;
  if (patch.rejectedSlotStarts && patch.rejectedSlotStarts.length > 0) return true;
  return false;
}

export function applyOfferedSlots<T extends AnyConversationContext>(
  context: T,
  offeredSlots: string[],
): T {
  const normalized = normalizeSessionMemory(context);
  const compatible = filterSlotsForSchedulingState(offeredSlots, normalized.scheduling);
  const slots = compatible.length > 0 ? compatible : offeredSlots;
  return {
    ...normalized,
    scheduling: {
      ...normalized.scheduling,
      status: "slots_offered",
      offeredSlots: slots,
      selectedStart: undefined,
      calendarEventId: undefined,
      lastOfferedEarliestMinutes: earliestOfferedMinutes(slots) ?? undefined,
      lastOfferedLatestMinutes: latestOfferedMinutes(slots) ?? undefined,
      lastOfferedSlotKey: offeredSlotConstraintKey(slots, normalized.scheduling),
      bookingPending: false,
      searchAfterMinutes: undefined,
      searchBeforeMinutes: undefined,
    },
    updatedAt: new Date().toISOString(),
  } as T;
}

export function applySchedulingMeta<T extends AnyConversationContext>(
  context: T,
  meta: {
    activeRequestKey?: string;
    availabilityAttempts?: number;
    bookingAttempts?: number;
    calendarUnavailable?: boolean;
    providerFailureReason?: string;
    applicationLogicFailure?: boolean;
    centralDate?: string;
    partOfDay?: SchedulingPartOfDay;
    anchorTimeMinutes?: number;
    searchAfterMinutes?: number;
    searchBeforeMinutes?: number;
    lastOfferedEarliestMinutes?: number;
    lastOfferedLatestMinutes?: number;
    rejectedPartOfDay?: SchedulingPartOfDay[];
    earliestAllowedMinutes?: number;
    latestAllowedMinutes?: number;
    rejectedSlotStarts?: string[];
    lastOfferedSlotKey?: string;
    bookingPending?: boolean;
  },
): T {
  const normalized = normalizeSessionMemory(context);
  return {
    ...normalized,
    scheduling: {
      ...normalized.scheduling,
      ...meta,
    },
    updatedAt: new Date().toISOString(),
  } as T;
}

export function applySchedulingIntent<T extends AnyConversationContext>(
  context: T,
  input: AvailabilityRangeInput,
  extras: {
    anchorTimeMinutes?: number;
    searchAfterMinutes?: number;
    searchBeforeMinutes?: number;
    earliestAllowedMinutes?: number;
    latestAllowedMinutes?: number;
    rejectedPartOfDay?: SchedulingPartOfDay[];
    rejectedSlotStarts?: string[];
  } = {},
): T {
  const normalized = normalizeSessionMemory(context);
  const scheduling = normalized.scheduling;
  const resolvedPartOfDay =
    input.partOfDay && input.partOfDay !== "full_day"
      ? input.partOfDay
      : scheduling.partOfDay;
  const patch = {
    centralDate: input.centralDate ?? scheduling.centralDate,
    partOfDay: resolvedPartOfDay,
    anchorTimeMinutes: extras.anchorTimeMinutes ?? scheduling.anchorTimeMinutes,
    searchAfterMinutes: extras.searchAfterMinutes,
    searchBeforeMinutes: extras.searchBeforeMinutes,
    earliestAllowedMinutes:
      extras.earliestAllowedMinutes ?? scheduling.earliestAllowedMinutes,
    latestAllowedMinutes: extras.latestAllowedMinutes ?? scheduling.latestAllowedMinutes,
    rejectedPartOfDay: extras.rejectedPartOfDay ?? scheduling.rejectedPartOfDay,
    rejectedSlotStarts: extras.rejectedSlotStarts ?? scheduling.rejectedSlotStarts,
  };
  let updated = applySchedulingMeta(normalized, patch) as T;
  if (constraintsMateriallyChanged(scheduling, patch)) {
    updated = invalidateIncompatibleOfferedSlots(updated);
  }
  return updated;
}

export function applyDisposition<T extends AnyConversationContext>(
  context: T,
  disposition: import("~/server/speed2Lead/sessionMemoryTypes").ConversationDisposition,
): T {
  const normalized = normalizeSessionMemory(context);
  return {
    ...normalized,
    disposition,
    updatedAt: new Date().toISOString(),
  } as T;
}

export function applySchedulingConstraints<T extends AnyConversationContext>(
  context: T,
  patch: Partial<
    Pick<
      SchedulingState,
      | "rejectedPartOfDay"
      | "partOfDay"
      | "anchorTimeMinutes"
      | "searchAfterMinutes"
      | "searchBeforeMinutes"
      | "earliestAllowedMinutes"
      | "latestAllowedMinutes"
      | "rejectedSlotStarts"
      | "centralDate"
    >
  >,
): T {
  const normalized = normalizeSessionMemory(context);
  const scheduling = normalized.scheduling;
  const mergedRejectedParts = patch.rejectedPartOfDay ?? scheduling.rejectedPartOfDay;
  const mergedRejectedSlots =
    patch.rejectedSlotStarts && patch.rejectedSlotStarts.length > 0
      ? [...new Set([...(scheduling.rejectedSlotStarts ?? []), ...patch.rejectedSlotStarts])]
      : scheduling.rejectedSlotStarts;

  const mergedPatch = {
    centralDate: patch.centralDate ?? scheduling.centralDate,
    partOfDay: patch.partOfDay ?? scheduling.partOfDay,
    anchorTimeMinutes: patch.anchorTimeMinutes ?? scheduling.anchorTimeMinutes,
    searchAfterMinutes: patch.searchAfterMinutes ?? scheduling.searchAfterMinutes,
    searchBeforeMinutes: patch.searchBeforeMinutes ?? scheduling.searchBeforeMinutes,
    earliestAllowedMinutes:
      patch.earliestAllowedMinutes ?? scheduling.earliestAllowedMinutes,
    latestAllowedMinutes: patch.latestAllowedMinutes ?? scheduling.latestAllowedMinutes,
    rejectedPartOfDay: mergedRejectedParts,
    rejectedSlotStarts: mergedRejectedSlots,
  };
  const normalizedPatch = normalizeSchedulingStateConstraints(
    { ...scheduling, ...mergedPatch },
    { prior: scheduling },
  );
  let updated = applySchedulingMeta(normalized, normalizedPatch) as T;
  if (constraintsMateriallyChanged(scheduling, normalizedPatch)) {
    updated = invalidateIncompatibleOfferedSlots(updated);
  }
  return updated;
}
