import type { ConsultationBusinessHours } from "~/server/appointmentLifecycle/consultationConfig";

/** Canonical availability preference — single source of truth. */
export type AvailabilityPreference =
  | "earliest"
  | "full_day"
  | "morning"
  | "afternoon"
  | "evening"
  | "exact_time";

export type SchedulingRequest = {
  timezone: string;
  requestedDate?: string;
  availabilityPreference: AvailabilityPreference;
  exactTimeMinutes?: number;
  /** Lower bound in minutes from midnight (inclusive). */
  lowerTimeBound?: number;
  /** Upper bound in minutes from midnight (inclusive). */
  upperTimeBound?: number;
  /** Anchor time for around/near ranking. */
  anchorTime?: number;
  businessHours: ConsultationBusinessHours;
  meetingDurationMinutes: number;
};

export type SchedulingOutcomeType =
  | "NEED_DATE"
  | "NEED_PREFERENCE"
  | "OFFERED_SLOTS"
  | "EXACT_TIME_AVAILABLE"
  | "NO_AVAILABILITY"
  | "BOOKED"
  | "PROVIDER_CONFLICT"
  | "PROVIDER_ERROR"
  | "INVALID_SELECTION";

export type OfferPresentationType =
  | "first_offer"
  | "repeat_offer"
  | "changed_offer"
  | "no_availability"
  | "booked"
  | "none";

export type ZeroSlotReason =
  | "provider_empty"
  | "constraint_filter"
  | "never_called"
  | "wrong_date"
  | "stale_state"
  | "provider_error";

export type ResponseSource =
  | "fresh_fetch"
  | "stale_state"
  | "no_provider";

export type CanonicalSchedulingState = {
  status: "idle" | "slots_offered" | "confirmed";
  requestedDate?: string;
  availabilityPreference?: AvailabilityPreference;
  exactTimeMinutes?: number;
  activeRequestKey?: string;
  offeredSlots?: string[];
  lastPresentedOfferKey?: string;
  selectedStart?: string;
  calendarEventId?: string;
  googleMeetUrl?: string;
  calendarUnavailable?: boolean;
  providerFailureReason?: string;
  bookingPending?: boolean;
};

export type ProviderDiagnostics = {
  providerInvoked: boolean;
  queryStartIso?: string;
  queryEndIso?: string;
  rawEventCount?: number;
  rawProviderSlotCount: number;
  filteredSlotCount: number;
  finalOfferedSlotCount: number;
  zeroSlotReason?: ZeroSlotReason;
};

export type BookingFailureStage =
  | "not_configured"
  | "recheck_failed"
  | "insert_failed"
  | "parse_failed"
  | "lifecycle_failed"
  | "unknown";

export type DetailedBookingFailureStage =
  | "not_configured"
  | "idempotency_error"
  | "recheck_error"
  | "calendar_insert_error"
  | "conference_creation_error"
  | "parse_failed"
  | "persistence_error"
  | "lifecycle_error"
  | "invalid_booking_input"
  | "missing_event_id"
  | "unknown_provider_error";

export type IdempotencyLookupResult =
  | "not_attempted"
  | "miss"
  | "hit_replayed"
  | "stale_miss"
  | "error";

export type StageResult = "not_attempted" | "started" | "succeeded" | "failed" | "skipped";

export type ProviderRecheckResult = "succeeded" | "failed" | "not_attempted" | "unknown";

export type CreateEventResult = "succeeded" | "failed" | "not_attempted";

export type SchedulingTrace = ProviderDiagnostics & {
  centralNow: { date: string; time: string; timezone: string };
  requestKeyBefore?: string;
  requestKeyAfter?: string;
  normalizedRequestedDate?: string;
  normalizedPreference?: AvailabilityPreference;
  normalizedExactTime?: number;
  lowerTimeBound?: number;
  upperTimeBound?: number;
  anchorTime?: number;
  staleStateInvalidated?: boolean;
  noAvailabilityReason?: string;
  finalOfferedSlots: string[];
  responseSource: ResponseSource;
  offerPresentationType: OfferPresentationType;
  selectionResolved?: boolean;
  bookingAttempted: boolean;
  selectedStart?: string;
  bookProviderSlotEntered?: boolean;
  bookConsultationEntered?: boolean;
  idempotencyLookupStarted?: boolean;
  idempotencyLookupResult?: IdempotencyLookupResult;
  recheckStarted?: boolean;
  recheckStageResult?: StageResult;
  providerRecheckAttempted?: boolean;
  providerRecheckResult?: ProviderRecheckResult;
  createConsultationEventEntered?: boolean;
  insertCalendarEventAttempted?: boolean;
  insertCalendarEventHttpStatus?: number;
  createEventAttempted?: boolean;
  createEventResult?: CreateEventResult;
  persistenceAttempted?: boolean;
  persistenceResult?: StageResult;
  lifecycleEntered?: boolean;
  lifecycleResult?: StageResult;
  bookingResultType?: SchedulingOutcomeType;
  finalBookingReason?: string;
  eventIdPresent: boolean;
  failureStage?: BookingFailureStage;
  detailedFailureStage?: DetailedBookingFailureStage;
  failureReason?: string;
  providerHttpStatus?: number;
  providerErrorReason?: string;
  providerErrorMessage?: string;
  sendUpdatesUsed?: string;
  bookingAttendeeCount?: number;
  attendeeIncluded?: boolean;
  conferenceRequested?: boolean;
  conferenceStatus?: string;
  googleMeetUrlPresent?: boolean;
  confirmationSmsAttempted?: boolean;
  confirmationSmsResult?: StageResult;
  reminder24Scheduled?: boolean;
  reminder2Scheduled?: boolean;
};

export type BookingCustomer = {
  phone: string;
  name: string;
  email?: string;
  businessName?: string;
  source: "roi" | "contact" | "demo";
  notes?: string;
};

import type { AvailabilityRangeInput } from "~/server/speed2Lead/schedulingRange";

export type ProcessSchedulingTurnInput = {
  inboundMessage: string;
  state: CanonicalSchedulingState;
  now: Date;
  maxOffer?: number;
  bookCustomer?: BookingCustomer;
  /** When set, book this slot directly (gate-planned selection). */
  explicitBookStart?: string;
  /** Gate-planned provider query input (refinement / exact-time / range). */
  availabilityInput?: AvailabilityRangeInput;
  /** When true, emit structured trace logs (preview allowlist). */
  tracePhoneSuffix?: string;
};

export type SchedulingTurnResult = {
  outcome: SchedulingOutcomeType;
  state: CanonicalSchedulingState;
  offeredSlots: string[];
  offerPresentationType: OfferPresentationType;
  selectedStart?: string;
  eventId?: string;
  googleMeetUrl?: string;
  lifecycleConfirmationSent?: boolean;
  closedDayDate?: string;
  trace: SchedulingTrace;
};
