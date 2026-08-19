export const MAX_CONVERSATION_MESSAGES = 20;

export type ConversationMessageRole = "user" | "assistant";

export type ConversationMessage = {
  role: ConversationMessageRole;
  content: string;
  at: string;
};

export type KnownFactsFlow = "roi" | "contact" | "demo";

export type KnownFactsUrgency = "low" | "medium" | "high";

export type KnownFactsFit = "yes" | "maybe" | "no";

export type KnownFacts = {
  firstName: string;
  phone: string;
  email?: string;
  businessName?: string;
  flow: KnownFactsFlow;
  primaryPain?: string;
  urgency?: KnownFactsUrgency;
  fit?: KnownFactsFit;
  objection?: string;
  customerGoal?: string;
  questionsAsked: number;
};

export type SchedulingStatus = "idle" | "slots_offered" | "confirmed";

export type SchedulingState = {
  status: SchedulingStatus;
  offeredSlots?: string[];
  selectedStart?: string;
  calendarEventId?: string;
};

export type SessionMemoryFields = {
  messages?: ConversationMessage[];
  knownFacts?: KnownFacts;
  scheduling?: SchedulingState;
  /** When true, knownFacts.questionsAsked is managed by the LLM orchestrator. */
  orchestratorManagedQuestions?: boolean;
};
