import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";
import { primaryPainLabel } from "~/server/speed2Lead/naturalLanguage";
import type { AvailabilityRangeInput } from "~/server/speed2Lead/schedulingRange";
import {
  earliestOfferedMinutes,
  latestOfferedMinutes,
} from "~/server/speed2Lead/slotRanking";
import { offeredSlotSetKey } from "~/server/speed2Lead/schedulingContext";
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
  const base: KnownFacts = {
    firstName: context.firstName,
    phone: normalizePhone(context.phone),
    flow,
    questionsAsked: 0,
  };

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
  };
  return {
    ...base,
    businessName: roi.businessName,
    customerGoal: roi.primaryOpportunity,
  };
}

export function syncKnownFactsFromDetections(
  context: AnyConversationContext,
  knownFacts: KnownFacts,
): KnownFacts {
  let updated = { ...knownFacts };

  if (context.detectedPains && context.detectedPains.length > 0) {
    updated = {
      ...updated,
      primaryPain: primaryPainLabel(context.detectedPains as PainCategory[]),
    };
  }

  if (context.lastCustomerMessage?.trim()) {
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

  const messages = context.messages ?? [];
  updated = {
    ...updated,
    questionsAsked:
      (context as SessionMemoryFields).orchestratorManagedQuestions === true
        ? knownFacts.questionsAsked
        : countAssistantQuestions(messages),
  };

  return updated;
}

function countAssistantQuestions(messages: ConversationMessage[]): number {
  return messages.filter(
    (message) =>
      message.role === "assistant" && message.content.trim().endsWith("?"),
  ).length;
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
    knownFacts: syncKnownFactsFromDetections(withMessages, withMessages.knownFacts),
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
    knownFacts: syncKnownFactsFromDetections(withMessages, withMessages.knownFacts),
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
  });

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
    scheduling: {
      ...normalized.scheduling,
      status: "confirmed",
      selectedStart: booking.selectedStart,
      calendarEventId: booking.calendarEventId,
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
  const { discoveryQuestionAsked, ...factsPatch } = update;
  let questionsAsked = normalized.knownFacts.questionsAsked;

  if (discoveryQuestionAsked) {
    questionsAsked += 1;
  }

  return {
    ...normalized,
    orchestratorManagedQuestions: true,
    knownFacts: {
      ...normalized.knownFacts,
      ...factsPatch,
      questionsAsked,
    },
    updatedAt: new Date().toISOString(),
  } as T;
}

export function applyOfferedSlots<T extends AnyConversationContext>(
  context: T,
  offeredSlots: string[],
): T {
  const normalized = normalizeSessionMemory(context);
  return {
    ...normalized,
    scheduling: {
      ...normalized.scheduling,
      status: "slots_offered",
      offeredSlots,
      selectedStart: undefined,
      calendarEventId: undefined,
      lastOfferedEarliestMinutes: earliestOfferedMinutes(offeredSlots) ?? undefined,
      lastOfferedLatestMinutes: latestOfferedMinutes(offeredSlots) ?? undefined,
      lastOfferedSlotKey: offeredSlotSetKey(offeredSlots),
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
  return applySchedulingMeta(normalized, {
    centralDate: input.centralDate ?? normalized.scheduling?.centralDate,
    partOfDay: input.partOfDay ?? normalized.scheduling?.partOfDay,
    anchorTimeMinutes: extras.anchorTimeMinutes ?? normalized.scheduling?.anchorTimeMinutes,
    searchAfterMinutes: extras.searchAfterMinutes,
    searchBeforeMinutes: extras.searchBeforeMinutes,
    earliestAllowedMinutes:
      extras.earliestAllowedMinutes ?? normalized.scheduling?.earliestAllowedMinutes,
    latestAllowedMinutes: extras.latestAllowedMinutes ?? normalized.scheduling?.latestAllowedMinutes,
    rejectedPartOfDay: extras.rejectedPartOfDay ?? normalized.scheduling?.rejectedPartOfDay,
    rejectedSlotStarts: extras.rejectedSlotStarts ?? normalized.scheduling?.rejectedSlotStarts,
  }) as T;
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

  return applySchedulingMeta(normalized, {
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
  }) as T;
}
