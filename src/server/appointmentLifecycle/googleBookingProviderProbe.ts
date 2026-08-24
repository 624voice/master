import { getConsultationDurationMinutes } from "~/server/appointmentLifecycle/consultationConfig";
import { getGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import {
  bookConsultation,
  type BookConsultationResult,
} from "~/server/appointmentLifecycle/bookConsultation";
import {
  cancelCalendarEvent,
  createConsultationEvent,
  insertCalendarEventWithDiagnostic,
  recheckConsultationStartAvailable,
  type ConsultationBookingFailureDiagnostics,
} from "~/server/appointmentLifecycle/googleCalendar";
import { isGoogleCalendarApiConfigured } from "~/server/appointmentLifecycle/config";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  logGoogleProviderDiagnostic,
} from "~/server/appointmentLifecycle/googleCredentials";

export const DIAGNOSTIC_BOOKING_PHONE = "+15559999041";
export const DIAGNOSTIC_BOOKING_EMAIL = "diag-preview@624voice.com";

export type BookingProviderProbeResult = {
  ok: boolean;
  mode: "create_only" | "full_bookConsultation";
  variant: "no_attendee" | "with_attendee";
  startIso: string;
  durationMinutes: number;
  calendarId: string | null;
  recheckAttempted: boolean;
  recheckSucceeded: boolean;
  createAttempted: boolean;
  eventCreated: boolean;
  eventIdPresent: boolean;
  eventId?: string;
  failureStage?:
    | "not_configured"
    | "recheck_failed"
    | "insert_failed"
    | "parse_failed"
    | "lifecycle_failed"
    | "cancel_failed";
  sendUpdatesUsed?: string;
  attendeeIncluded: boolean;
  attendeeCount: number;
  eventStartIso?: string;
  eventEndIso?: string;
  httpStatus?: number;
  googleErrorReason?: string;
  googleErrorMessage?: string;
  requestEndpoint?: string;
  cleanupAttempted?: boolean;
  cleanupSucceeded?: boolean;
  diagnosticEventLabel: string;
  bookConsultationReason?: string;
  credentialDiagnostics: ReturnType<typeof getGoogleServiceAccountCredentialDiagnostics>;
};

function buildProbeInput(args: {
  start: string;
  includeAttendee: boolean;
  attendeeEmail?: string;
  now?: Date;
}) {
  return {
    start: args.start,
    attendeeName: "624Voice Diagnostic",
    attendeeEmail: args.includeAttendee
      ? (args.attendeeEmail?.trim() || DIAGNOSTIC_BOOKING_EMAIL)
      : undefined,
    phone: DIAGNOSTIC_BOOKING_PHONE,
    businessName: "624Voice Diagnostic Event",
    source: "roi" as const,
    notes: "[DIAGNOSTIC] Preview booking-provider smoke — safe to delete",
    now: args.now,
  };
}

function fromCreateFailure(
  diagnostics: ConsultationBookingFailureDiagnostics | undefined,
  reason: string,
): Pick<
  BookingProviderProbeResult,
  | "failureStage"
  | "httpStatus"
  | "googleErrorReason"
  | "googleErrorMessage"
  | "sendUpdatesUsed"
  | "attendeeCount"
  | "eventStartIso"
  | "eventEndIso"
> {
  if (reason === "slot_unavailable") {
    return { failureStage: "recheck_failed" };
  }
  return {
    failureStage: "insert_failed",
    httpStatus: diagnostics?.insertHttpStatus,
    googleErrorReason: diagnostics?.googleErrorReason,
    googleErrorMessage: diagnostics?.googleErrorMessage,
    sendUpdatesUsed: diagnostics?.sendUpdatesUsed,
    attendeeCount: diagnostics?.attendeeCount ?? 0,
    eventStartIso: diagnostics?.eventStartIso,
    eventEndIso: diagnostics?.eventEndIso,
  };
}

async function cleanupDiagnosticEvent(eventId?: string): Promise<{
  cleanupAttempted: boolean;
  cleanupSucceeded: boolean;
}> {
  if (!eventId) {
    return { cleanupAttempted: false, cleanupSucceeded: false };
  }
  const cleanupSucceeded = await cancelCalendarEvent(eventId);
  return { cleanupAttempted: true, cleanupSucceeded };
}

/** Preview-only booking provider probe using the same createConsultationEvent path as SMS booking. */
export async function probeConsultationBookingCreatePath(args: {
  start: string;
  includeAttendee: boolean;
  attendeeEmail?: string;
  cleanup?: boolean;
  now?: Date;
}): Promise<BookingProviderProbeResult> {
  const credentialDiagnostics = getGoogleServiceAccountCredentialDiagnostics();
  const calendarId = getGoogleCalendarId();
  const durationMinutes = getConsultationDurationMinutes();
  const variant = args.includeAttendee ? "with_attendee" : "no_attendee";
  const input = buildProbeInput(args);
  const attendeeCount = args.includeAttendee ? 1 : 0;

  const base: BookingProviderProbeResult = {
    ok: false,
    mode: "create_only",
    variant,
    startIso: args.start,
    durationMinutes,
    calendarId,
    recheckAttempted: false,
    recheckSucceeded: false,
    createAttempted: false,
    eventCreated: false,
    eventIdPresent: false,
    attendeeIncluded: args.includeAttendee,
    attendeeCount,
    diagnosticEventLabel: "[DIAGNOSTIC] Preview booking-provider smoke — safe to delete",
    credentialDiagnostics,
  };

  if (!isGoogleCalendarApiConfigured()) {
    return { ...base, failureStage: "not_configured" };
  }

  const recheckSucceeded = await recheckConsultationStartAvailable(args.start, args.now);
  const result = await createConsultationEvent(input);

  logGoogleProviderDiagnostic(
    {
      ...credentialDiagnostics,
      tokenGenerationSucceeded: true,
      failureStage: result.ok ? undefined : "calendar_api",
      requestEndpoint: result.ok ? "calendar.events.insert" : "calendar.events.insert",
      requestStartIso: args.start,
      requestEndIso: new Date(new Date(args.start).getTime() + durationMinutes * 60_000).toISOString(),
      httpStatus: !result.ok && "diagnostics" in result ? result.diagnostics?.insertHttpStatus : 200,
      googleErrorReason:
        !result.ok && "diagnostics" in result ? result.diagnostics?.googleErrorReason : undefined,
      googleErrorMessage:
        !result.ok && "diagnostics" in result ? result.diagnostics?.googleErrorMessage : undefined,
    },
    {
      probe: true,
      variant,
      recheckSucceeded,
      attendeeCount,
      sendUpdatesUsed:
        !result.ok && "diagnostics" in result ? result.diagnostics?.sendUpdatesUsed : "none_or_all",
    },
  );

  if (!result.ok) {
    const failure = fromCreateFailure(result.diagnostics, result.reason);
    return {
      ...base,
      recheckAttempted: result.diagnostics?.recheckAttempted ?? true,
      recheckSucceeded: result.diagnostics?.recheckSucceeded ?? recheckSucceeded,
      createAttempted: result.diagnostics?.createAttempted ?? result.reason !== "slot_unavailable",
      ...failure,
      attendeeCount: result.diagnostics?.attendeeCount ?? attendeeCount,
      bookConsultationReason: result.reason,
    };
  }

  let cleanup = { cleanupAttempted: false, cleanupSucceeded: false };
  if (args.cleanup !== false) {
    cleanup = await cleanupDiagnosticEvent(result.eventId);
  }

  return {
    ...base,
    ok: true,
    recheckAttempted: true,
    recheckSucceeded: true,
    createAttempted: true,
    eventCreated: true,
    eventIdPresent: true,
    eventId: result.eventId,
    sendUpdatesUsed: args.includeAttendee ? "all" : undefined,
    eventStartIso: args.start,
    eventEndIso: new Date(new Date(args.start).getTime() + durationMinutes * 60_000).toISOString(),
    httpStatus: 200,
    requestEndpoint: "calendar.events.insert",
    ...cleanup,
  };
}

/** Optional full agent path including appointment lifecycle after event creation. */
export async function probeConsultationBookingFullPath(args: {
  start: string;
  includeAttendee: boolean;
  attendeeEmail?: string;
  cleanup?: boolean;
  now?: Date;
}): Promise<BookingProviderProbeResult> {
  const createProbe = await probeConsultationBookingCreatePath({
    ...args,
    cleanup: false,
  });
  if (!createProbe.ok) {
    return { ...createProbe, mode: "full_bookConsultation" };
  }

  const booked: BookConsultationResult = await bookConsultation(
    buildProbeInput(args),
  );

  let cleanup = { cleanupAttempted: false, cleanupSucceeded: false };
  const eventId = booked.ok ? booked.eventId : createProbe.eventId;
  if (args.cleanup !== false && eventId) {
    cleanup = await cleanupDiagnosticEvent(eventId);
  }

  if (!booked.ok) {
    return {
      ...createProbe,
      mode: "full_bookConsultation",
      ok: false,
      failureStage: "lifecycle_failed",
      bookConsultationReason: booked.reason,
      eventId,
      eventIdPresent: Boolean(eventId),
      ...cleanup,
    };
  }

  return {
    ...createProbe,
    mode: "full_bookConsultation",
    ok: true,
    eventId: booked.eventId,
    eventIdPresent: Boolean(booked.eventId),
    ...cleanup,
  };
}

export async function compareConsultationBookingVariants(args: {
  start: string;
  attendeeEmail?: string;
  cleanup?: boolean;
  now?: Date;
}): Promise<{
  startIso: string;
  calendarId: string | null;
  withoutAttendee: BookingProviderProbeResult;
  withAttendee: BookingProviderProbeResult;
}> {
  const withoutAttendee = await probeConsultationBookingCreatePath({
    start: args.start,
    includeAttendee: false,
    cleanup: args.cleanup,
    now: args.now,
  });
  const withAttendee = await probeConsultationBookingCreatePath({
    start: args.start,
    includeAttendee: true,
    attendeeEmail: args.attendeeEmail,
    cleanup: args.cleanup,
    now: args.now,
  });

  return {
    startIso: args.start,
    calendarId: getGoogleCalendarId(),
    withoutAttendee,
    withAttendee,
  };
}

/** Direct insert payload diff helper for diagnostics documentation. */
export async function describeConsultationInsertPayload(args: {
  start: string;
  includeAttendee: boolean;
  attendeeEmail?: string;
}): Promise<{
  attendeeIncluded: boolean;
  attendeeCount: number;
  sendUpdatesUsed?: string;
  summaryPrefix: string;
  hasAttendeesField: boolean;
}> {
  const input = buildProbeInput(args);
  const body = {
    summary: `624Voice AI Consultation - ${input.businessName ?? input.attendeeName}`,
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
  };
  return {
    attendeeIncluded: Boolean(input.attendeeEmail),
    attendeeCount: input.attendeeEmail ? 1 : 0,
    sendUpdatesUsed: input.attendeeEmail ? "all" : undefined,
    summaryPrefix: body.summary,
    hasAttendeesField: Boolean(body.attendees),
  };
}

export { insertCalendarEventWithDiagnostic };

/** Handset session 8991 equivalent inputs for bookProviderSlot diagnostics. */
export const HANDSET_REPRO_PHONE = "+12148438991";
export const HANDSET_REPRO_START = "2026-08-26T14:00:00.000Z";
export const HANDSET_REPRO_FIRST_NAME = "13";
export const HANDSET_REPRO_BUSINESS_NAME = "13";

export type HandsetBookProviderProbeResult = {
  ok: boolean;
  mode: "handset_book_provider_slot";
  entrypoint: "bookProviderSlot";
  startIso: string;
  phoneSuffix: string;
  attendeeIncluded: boolean;
  attendeeCount: number;
  bookingResult: Awaited<ReturnType<typeof import("~/server/scheduling/provider").bookProviderSlot>>;
  stageSnapshot?: import("~/server/scheduling/bookingStageTrace").BookingStageSnapshot;
  smokePathComparison: {
    smokeUses: "createConsultationEvent";
    handsetUses: "bookProviderSlot → bookConsultation → createConsultationEvent → processCalendarEvent";
    inputDiff: Array<{ field: string; smoke: string; handset: string }>;
  };
  cleanupAttempted?: boolean;
  cleanupSucceeded?: boolean;
};

export async function probeHandsetEquivalentBookProviderSlot(args: {
  start?: string;
  phone?: string;
  firstName?: string;
  businessName?: string;
  email?: string;
  cleanup?: boolean;
  now?: Date;
}): Promise<HandsetBookProviderProbeResult> {
  const { bookProviderSlot } = await import("~/server/scheduling/provider");
  const start = args.start ?? HANDSET_REPRO_START;
  const phone = args.phone ?? HANDSET_REPRO_PHONE;
  const firstName = args.firstName ?? HANDSET_REPRO_FIRST_NAME;
  const businessName = args.businessName ?? HANDSET_REPRO_BUSINESS_NAME;
  const email = args.email ?? "handset-repro@624voice.com";
  const attendeeIncluded = Boolean(email.trim());

  const bookingResult = await bookProviderSlot({
    start,
    customer: {
      phone,
      name: firstName,
      email,
      businessName,
      source: "roi",
    },
    now: args.now,
    phoneSuffix: phone.slice(-4),
    selectionResolved: true,
  });

  let cleanup = { cleanupAttempted: false, cleanupSucceeded: false };
  if (args.cleanup !== false && bookingResult.ok) {
    cleanup = await cleanupDiagnosticEvent(bookingResult.eventId);
  }

  const smokeInput = buildProbeInput({
    start,
    includeAttendee: true,
    attendeeEmail: DIAGNOSTIC_BOOKING_EMAIL,
  });

  return {
    ok: bookingResult.ok,
    mode: "handset_book_provider_slot",
    entrypoint: "bookProviderSlot",
    startIso: start,
    phoneSuffix: phone.slice(-4),
    attendeeIncluded,
    attendeeCount: attendeeIncluded ? 1 : 0,
    bookingResult,
    stageSnapshot: !bookingResult.ok ? bookingResult.diagnostics?.stageSnapshot : undefined,
    smokePathComparison: {
      smokeUses: "createConsultationEvent",
      handsetUses:
        "bookProviderSlot → bookConsultation → createConsultationEvent → processCalendarEvent",
      inputDiff: [
        { field: "entry", smoke: "createConsultationEvent", handset: "bookProviderSlot" },
        { field: "phone", smoke: DIAGNOSTIC_BOOKING_PHONE, handset: phone },
        { field: "attendeeName", smoke: smokeInput.attendeeName, handset: firstName },
        { field: "businessName", smoke: smokeInput.businessName ?? "", handset: businessName },
        { field: "email", smoke: DIAGNOSTIC_BOOKING_EMAIL, handset: "[provided]" },
        { field: "lifecycle", smoke: "skipped (create_only)", handset: "processCalendarEvent runs" },
      ],
    },
    ...cleanup,
  };
}
