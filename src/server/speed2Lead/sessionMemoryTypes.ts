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

export type DiscoveryPhase =
  | "awaiting_report_reaction"
  | "diagnostic"
  | "discovery_complete"
  | "bridge"
  | "scheduling"
  | "booked";

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
  /** Monotonic ROI discovery progress — code-owned. */
  discoveryPhase?: DiscoveryPhase;
  /** Highest discovery phase reached; never regresses on normalize. */
  peakDiscoveryPhase?: DiscoveryPhase;
  /** Diagnostic discovery questions asked after report reaction (max 2). Opening question excluded. */
  diagnosticQuestionsAsked?: number;
  /** @deprecated Use diagnosticQuestionsAsked. Kept for backward-compatible session reads. */
  questionsAsked: number;
  /** Customer agreed to a low-pressure meeting bridge or explicitly asked to schedule. */
  meetingBridgeComplete?: boolean;
};

export type SchedulingStatus = "idle" | "slots_offered" | "confirmed";

export type SchedulingPartOfDay = "morning" | "afternoon" | "evening" | "full_day";

export type ConversationDisposition =
  | "active"
  | "soft_closed"
  | "declined"
  | "scheduling"
  | "booked";

export type SchedulingState = {
  status: SchedulingStatus;
  offeredSlots?: string[];
  selectedStart?: string;
  calendarEventId?: string;
  /** Stable key for the current scheduling preference/range request. */
  activeRequestKey?: string;
  /** Failed availability lookups scoped to activeRequestKey. */
  availabilityAttempts?: number;
  /** Booking attempts scoped to activeRequestKey. */
  bookingAttempts?: number;
  calendarUnavailable?: boolean;
  /** Normalized day preference retained across turns. */
  centralDate?: string;
  /** Normalized part-of-day preference retained across turns. */
  partOfDay?: SchedulingPartOfDay;
  /** Anchor time in minutes from midnight when customer names a target time. */
  anchorTimeMinutes?: number;
  /** Search only for slots after this minute on the active day. */
  searchAfterMinutes?: number;
  /** Search only for slots before this minute on the active day. */
  searchBeforeMinutes?: number;
  /** Most recent offered range for relative refinements. */
  lastOfferedEarliestMinutes?: number;
  lastOfferedLatestMinutes?: number;
  /** Parts of day the customer explicitly rejected. */
  rejectedPartOfDay?: SchedulingPartOfDay[];
  /** Earliest acceptable slot minute (customer constraint). */
  earliestAllowedMinutes?: number;
  /** Latest acceptable slot minute (customer constraint). */
  latestAllowedMinutes?: number;
  /** ISO starts the customer rejected — avoid re-offering. */
  rejectedSlotStarts?: string[];
  /** Stable fingerprint of the last slot set offered to the customer. */
  lastOfferedSlotKey?: string;
  /** True while a validated slot selection is being booked. */
  bookingPending?: boolean;
  /** Prior turn emitted a blocked/rejected self-scheduling fallback; recover conversationally. */
  lastBlockedFallback?: boolean;
  /** Internal planning/parsing failure — never authorize calendar-link fallback. */
  applicationLogicFailure?: boolean;
  /** Last provider-side calendar failure reason when known. */
  providerFailureReason?: string;
};

export type SessionMemoryFields = {
  messages?: ConversationMessage[];
  knownFacts?: KnownFacts;
  scheduling?: SchedulingState;
  /** Lightweight conversation posture for re-engagement guardrails. */
  disposition?: ConversationDisposition;
  /** When true, knownFacts.questionsAsked is managed by the LLM orchestrator. */
  orchestratorManagedQuestions?: boolean;
};
