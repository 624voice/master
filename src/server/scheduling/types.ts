import type { ConsultationBusinessHours } from "~/server/appointmentLifecycle/consultationConfig";

/** Canonical availability preference — single source of truth. */
export type AvailabilityPreference =
  | "earliest"
  | "full_day"
  | "morning"
  | "afternoon"
  | "exact_time";

export type SchedulingRequest = {
  timezone: string;
  requestedDate?: string;
  availabilityPreference: AvailabilityPreference;
  exactTimeMinutes?: number;
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

export type SchedulingTrace = ProviderDiagnostics & {
  centralNow: { date: string; time: string; timezone: string };
  requestKeyBefore?: string;
  requestKeyAfter?: string;
  normalizedRequestedDate?: string;
  normalizedPreference?: AvailabilityPreference;
  normalizedExactTime?: number;
  finalOfferedSlots: string[];
  responseSource: ResponseSource;
  offerPresentationType: OfferPresentationType;
  bookingAttempted: boolean;
  bookingResultType?: SchedulingOutcomeType;
  eventIdPresent: boolean;
};

export type SchedulingTurnResult = {
  outcome: SchedulingOutcomeType;
  state: CanonicalSchedulingState;
  offeredSlots: string[];
  offerPresentationType: OfferPresentationType;
  selectedStart?: string;
  eventId?: string;
  lifecycleConfirmationSent?: boolean;
  trace: SchedulingTrace;
};

export type BookingCustomer = {
  phone: string;
  name: string;
  email?: string;
  businessName?: string;
  source: "roi" | "contact" | "demo";
  notes?: string;
};

export type ProcessSchedulingTurnInput = {
  inboundMessage: string;
  state: CanonicalSchedulingState;
  now: Date;
  maxOffer?: number;
  bookCustomer?: BookingCustomer;
  /** When true, emit structured trace logs (preview allowlist). */
  tracePhoneSuffix?: string;
};
