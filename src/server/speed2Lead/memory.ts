import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";
import { analyzeMessage, primaryPainLabel } from "~/server/speed2Lead/naturalLanguage";
import type { TurnSemantics } from "~/server/speed2Lead/sessionMemoryTypes";
import type {
  ConversationMessage,
  ConversationMessageRole,
  KnownFacts,
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

function normalizeDiscoveryFacts(facts: KnownFacts): KnownFacts {
  const asked = facts.diagnosticQuestionsAsked ?? facts.questionsAsked ?? 0;
  return {
    ...facts,
    questionsAsked: asked,
    diagnosticQuestionsAsked: asked,
  };
}

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

function resolveFlow(context: AnyConversationContext): KnownFacts["flow"] {
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

function simplePainLabel(pains: PainCategory[]): string {
  if (pains.length === 0) return primaryPainLabel(pains);
  const first = pains[0]!;
  const labels: Partial<Record<PainCategory, string>> = {
    missed_calls: "missed calls",
    slow_response: "slow response",
    follow_up: "follow-up gaps",
    after_hours: "after-hours coverage",
    workload: "office workload",
    website: "website leads",
    scheduling: "scheduling gaps",
    multiple: "missed opportunities",
  };
  return labels[first] ?? primaryPainLabel(pains);
}

function syncKnownFactsFromDetections(
  context: AnyConversationContext,
  knownFacts: KnownFacts,
  _semantics?: TurnSemantics,
): KnownFacts {
  let updated = normalizeDiscoveryFacts(knownFacts);

  if (context.lastCustomerMessage?.trim()) {
    const signals = analyzeMessage(context.lastCustomerMessage);
    if (signals.pains.length > 0) {
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

  if (context.lastCustomerMessage?.trim() && context.flow !== "roi") {
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
  const knownFacts = syncKnownFactsFromDetections(
    context,
    {
      ...initial.knownFacts,
      ...context.knownFacts,
    },
    context.lastTurnSemantics,
  );

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
  booking: { selectedStart: string; calendarEventId: string; googleMeetUrl?: string },
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
      googleMeetUrl: booking.googleMeetUrl,
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
      bookingPending: false,
    },
    updatedAt: new Date().toISOString(),
  } as T;
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
