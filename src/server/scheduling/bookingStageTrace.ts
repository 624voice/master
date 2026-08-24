import type {
  BookingFailureStage,
  DetailedBookingFailureStage,
  IdempotencyLookupResult,
  SchedulingTrace,
  StageResult,
} from "~/server/scheduling/types";

export type { IdempotencyLookupResult, StageResult, DetailedBookingFailureStage };

export type BookingStageSnapshot = {
  selectionResolved?: boolean;
  selectedStart?: string;
  bookProviderSlotEntered: boolean;
  bookConsultationEntered: boolean;
  idempotencyLookupStarted: boolean;
  idempotencyLookupResult: IdempotencyLookupResult;
  recheckStarted: boolean;
  recheckResult: StageResult;
  createConsultationEventEntered: boolean;
  insertCalendarEventAttempted: boolean;
  insertCalendarEventHttpStatus?: number;
  createEventResult: StageResult;
  eventIdPresent: boolean;
  persistenceAttempted: boolean;
  persistenceResult: StageResult;
  lifecycleEntered: boolean;
  lifecycleResult: StageResult;
  finalBookingReason?: string;
  failureStage?: DetailedBookingFailureStage;
  failureReason?: string;
  providerErrorReason?: string;
  providerErrorMessage?: string;
  sendUpdatesUsed?: string;
  attendeeCount?: number;
  attendeeIncluded?: boolean;
  calendarId?: string;
  bookingKeySuffix?: string;
  conferenceRequested?: boolean;
  conferenceStatus?: string;
  googleMeetUrlPresent?: boolean;
  confirmationSmsAttempted?: boolean;
  confirmationSmsResult?: StageResult;
  reminder24Scheduled?: boolean;
  reminder2Scheduled?: boolean;
};

export type BookingStageCollector = BookingStageSnapshot & {
  phoneSuffix?: string;
};

export function createBookingStageCollector(args?: {
  selectedStart?: string;
  selectionResolved?: boolean;
  phoneSuffix?: string;
}): BookingStageCollector {
  return {
    selectionResolved: args?.selectionResolved,
    selectedStart: args?.selectedStart,
    phoneSuffix: args?.phoneSuffix,
    bookProviderSlotEntered: false,
    bookConsultationEntered: false,
    idempotencyLookupStarted: false,
    idempotencyLookupResult: "not_attempted",
    recheckStarted: false,
    recheckResult: "not_attempted",
    createConsultationEventEntered: false,
    insertCalendarEventAttempted: false,
    createEventResult: "not_attempted",
    eventIdPresent: false,
    persistenceAttempted: false,
    persistenceResult: "not_attempted",
    lifecycleEntered: false,
    lifecycleResult: "not_attempted",
  };
}

let activeBookingStageCollector: BookingStageCollector | null = null;

export function getActiveBookingStageCollector(): BookingStageCollector | null {
  return activeBookingStageCollector;
}

export async function withBookingStageCollector<T>(
  collector: BookingStageCollector,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = activeBookingStageCollector;
  activeBookingStageCollector = collector;
  try {
    return await fn();
  } finally {
    activeBookingStageCollector = previous;
  }
}

export function logBookingStageTrace(collector: BookingStageCollector): void {
  console.log(
    JSON.stringify({
      component: "bookingStageTrace",
      event: "booking_stage_trace",
      at: new Date().toISOString(),
      phoneSuffix: collector.phoneSuffix ? `***${collector.phoneSuffix}` : undefined,
      ...collector,
    }),
  );
}

export function mapDetailedFailureStage(
  stage: DetailedBookingFailureStage | undefined,
): BookingFailureStage {
  switch (stage) {
    case "not_configured":
      return "not_configured";
    case "recheck_error":
      return "recheck_failed";
    case "calendar_insert_error":
      return "insert_failed";
    case "conference_creation_error":
      return "insert_failed";
    case "parse_failed":
    case "missing_event_id":
      return "parse_failed";
    case "lifecycle_error":
      return "lifecycle_failed";
    case "idempotency_error":
    case "persistence_error":
    case "invalid_booking_input":
    case "unknown_provider_error":
    default:
      return "unknown";
  }
}

export function applyBookingStageSnapshotToSchedulingTrace(
  trace: SchedulingTrace,
  snapshot: BookingStageSnapshot,
): void {
  trace.selectionResolved = snapshot.selectionResolved;
  trace.selectedStart = snapshot.selectedStart;
  trace.bookProviderSlotEntered = snapshot.bookProviderSlotEntered;
  trace.bookConsultationEntered = snapshot.bookConsultationEntered;
  trace.idempotencyLookupStarted = snapshot.idempotencyLookupStarted;
  trace.idempotencyLookupResult = snapshot.idempotencyLookupResult;
  trace.recheckStarted = snapshot.recheckStarted;
  trace.recheckStageResult = snapshot.recheckResult;
  trace.createConsultationEventEntered = snapshot.createConsultationEventEntered;
  trace.insertCalendarEventAttempted = snapshot.insertCalendarEventAttempted;
  trace.insertCalendarEventHttpStatus = snapshot.insertCalendarEventHttpStatus;
  trace.createEventResult =
    snapshot.createEventResult === "succeeded"
      ? "succeeded"
      : snapshot.createEventResult === "failed"
        ? "failed"
        : snapshot.createEventResult === "started"
          ? "failed"
          : "not_attempted";
  trace.eventIdPresent = snapshot.eventIdPresent;
  trace.persistenceAttempted = snapshot.persistenceAttempted;
  trace.persistenceResult = snapshot.persistenceResult;
  trace.lifecycleEntered = snapshot.lifecycleEntered;
  trace.lifecycleResult = snapshot.lifecycleResult;
  trace.finalBookingReason = snapshot.finalBookingReason;
  trace.detailedFailureStage = snapshot.failureStage;
  trace.failureReason = snapshot.failureReason;
  trace.providerErrorReason = snapshot.providerErrorReason;
  trace.providerErrorMessage = snapshot.providerErrorMessage;
  trace.sendUpdatesUsed = snapshot.sendUpdatesUsed;
  trace.bookingAttendeeCount = snapshot.attendeeCount;
  trace.attendeeIncluded = snapshot.attendeeIncluded;
  trace.conferenceRequested = snapshot.conferenceRequested;
  trace.conferenceStatus = snapshot.conferenceStatus;
  trace.googleMeetUrlPresent = snapshot.googleMeetUrlPresent;
  trace.confirmationSmsAttempted = snapshot.confirmationSmsAttempted;
  trace.confirmationSmsResult = snapshot.confirmationSmsResult;
  trace.reminder24Scheduled = snapshot.reminder24Scheduled;
  trace.reminder2Scheduled = snapshot.reminder2Scheduled;
  trace.providerRecheckAttempted = snapshot.recheckStarted;
  trace.providerRecheckResult =
    snapshot.recheckResult === "succeeded"
      ? "succeeded"
      : snapshot.recheckResult === "failed"
        ? "failed"
        : snapshot.recheckResult === "started"
          ? "unknown"
          : "not_attempted";
  trace.createEventAttempted =
    snapshot.createConsultationEventEntered || snapshot.insertCalendarEventAttempted;
  trace.providerHttpStatus = snapshot.insertCalendarEventHttpStatus;
  if (snapshot.failureStage) {
    trace.failureStage = mapDetailedFailureStage(snapshot.failureStage);
  }
}
