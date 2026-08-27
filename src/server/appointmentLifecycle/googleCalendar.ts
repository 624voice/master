import { createSign } from "node:crypto";
import {
  buildGoogleMeetConferenceCreateRequest,
  extractGoogleMeetUrl,
  isConferenceFailureStatus,
  isConferencePendingStatus,
  readConferenceStatus,
  GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE,
} from "~/server/appointmentLifecycle/googleMeetConference";
import {
  CONSULTATION_TIMEZONE,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBusyIntervalsFromEvents,
  isSlotAvailable,
  expandBusyIntervals,
  selectConsultationSlots,
  type BusyInterval,
} from "~/server/appointmentLifecycle/consultationSlots";
import {
  getGoogleCalendarId,
  isGoogleCalendarApiConfigured,
  isGoogleCalendarBookingConfigured,
  resolveGoogleCalendarId,
} from "~/server/appointmentLifecycle/config";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  logGoogleProviderDiagnostic,
  sanitizeGoogleApiErrorBody,
} from "~/server/appointmentLifecycle/googleCredentials";
import {
  getGoogleCalendarProviderAccessToken,
  GoogleCalendarAuthError,
  resetGoogleCalendarAuthCacheForTests,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  parseGoogleCalendarApiEvent,
  type GoogleCalendarApiEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import type { NormalizedCalendarEvent, S2LSource } from "~/server/appointmentLifecycle/types";
import { getActiveBookingStageCollector } from "~/server/scheduling/bookingStageTrace";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

function logProviderFailure(
  failureStage: "not_configured" | "invalid_private_key" | "token_exchange" | "calendar_api",
  extra: {
    requestEndpoint?: "oauth2.token" | "calendar.events.list";
    requestStartIso?: string;
    requestEndIso?: string;
    httpStatus?: number;
    googleErrorReason?: string;
    googleErrorMessage?: string;
    tokenGenerationSucceeded?: boolean;
  } = {},
): void {
  const diagnostic = {
    ...getGoogleServiceAccountCredentialDiagnostics(),
    tokenGenerationSucceeded: extra.tokenGenerationSucceeded ?? false,
    failureStage,
    ...extra,
  };
  logGoogleProviderDiagnostic(diagnostic);
  logAppointmentEvent("google_provider_diagnostic", {
    failureStage,
    requestEndpoint: extra.requestEndpoint,
    httpStatus: extra.httpStatus,
    googleErrorReason: extra.googleErrorReason,
    tokenGenerationSucceeded: diagnostic.tokenGenerationSucceeded,
  });
}

async function getProviderAccessToken(): Promise<string> {
  try {
    return await getGoogleCalendarProviderAccessToken();
  } catch (error) {
    if (error instanceof GoogleCalendarAuthError) {
      logProviderFailure("token_exchange", {
        requestEndpoint: "oauth2.token",
        googleErrorMessage: error.detail ?? error.message,
        tokenGenerationSucceeded: false,
      });
    }
    throw error;
  }
}

export { getGoogleCalendarProviderAccessToken } from "~/server/appointmentLifecycle/googleCalendarAuth";

export async function fetchCalendarEventsUpdatedSince(
  updatedMin: string,
): Promise<NormalizedCalendarEvent[]> {
  if (!(await isGoogleCalendarApiConfigured())) {
    return [];
  }

  const calendarId = await resolveGoogleCalendarId();
  if (!calendarId) {
    return [];
  }

  try {
    const token = await getProviderAccessToken();
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "updated",
      updatedMin,
      maxResults: "50",
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      logAppointmentEvent("calendar_api_error", {
        action: "list_events",
        status: response.status,
        body: text.slice(0, 200),
      });
      return [];
    }

    const data = (await response.json()) as { items?: GoogleCalendarApiEvent[] };
    const events: NormalizedCalendarEvent[] = [];

    for (const item of data.items ?? []) {
      const parsed = parseGoogleCalendarApiEvent(item);
      if (parsed) {
        events.push(parsed);
      }
    }

    return events;
  } catch (error) {
    logAppointmentEvent("calendar_api_error", {
      action: "list_events",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function cancelCalendarEvent(eventId: string): Promise<boolean> {
  if (!(await isGoogleCalendarApiConfigured())) {
    return false;
  }

  const calendarId = await resolveGoogleCalendarId();
  if (!calendarId) {
    return false;
  }

  try {
    const token = await getProviderAccessToken();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!response.ok) {
      logAppointmentEvent("calendar_api_error", {
        action: "cancel_event",
        eventId,
        status: response.status,
      });
      return false;
    }

    return true;
  } catch (error) {
    logAppointmentEvent("calendar_api_error", {
      action: "cancel_event",
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function resetGoogleTokenCacheForTests(): void {
  resetGoogleCalendarAuthCacheForTests();
}

const BOOKING_IDEMPOTENCY_PREFIX = "appointment:booking:idempotency:";
const BOOKING_IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 7;

type BookingIdempotencyRecord = {
  eventId: string;
  start: string;
  phone: string;
  googleMeetUrl: string;
  createdAt: string;
};

export type GetConsultationSlotsInput = {
  rangeStart: string | Date;
  rangeEnd: string | Date;
  maxSlots?: number;
  now?: Date;
};

export type GetConsultationSlotsResult =
  | { ok: true; slots: string[] }
  | { ok: false; reason: "not_configured" | "calendar_api_error"; detail?: string };

export type CreateConsultationEventInput = {
  start: string;
  attendeeName: string;
  attendeeEmail?: string;
  phone: string;
  businessName?: string;
  source: S2LSource;
  notes?: string;
  /** Override clock for availability checks (tests and deterministic callers). */
  now?: Date;
};

export type CreateConsultationEventSuccess = {
  ok: true;
  eventId: string;
  normalizedEvent: NormalizedCalendarEvent;
  googleMeetUrl: string;
  replayed: boolean;
};

export type ConsultationBookingFailureDiagnostics = {
  recheckSucceeded: boolean;
  recheckAttempted: boolean;
  createAttempted: boolean;
  createSucceeded: boolean;
  sendUpdatesUsed?: string;
  attendeeCount: number;
  attendeeIncluded?: boolean;
  conferenceRequested?: boolean;
  conferenceStatus?: string;
  googleMeetUrlPresent?: boolean;
  calendarId?: string;
  eventStartIso?: string;
  eventEndIso?: string;
  insertHttpStatus?: number;
  googleErrorReason?: string;
  googleErrorMessage?: string;
};

export type CreateConsultationEventFailure = {
  ok: false;
  reason: "not_configured" | "slot_unavailable" | "calendar_api_error" | "conference_error";
  detail?: string;
  diagnostics?: ConsultationBookingFailureDiagnostics;
};

export type CreateConsultationEventResult =
  | CreateConsultationEventSuccess
  | CreateConsultationEventFailure;

export {
  GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE,
  buildGoogleMeetConferenceCreateRequest,
  createGoogleMeetConferenceRequestId,
  extractGoogleMeetUrl,
} from "~/server/appointmentLifecycle/googleMeetConference";

export function buildConsultationBookingKey(phone: string, start: string): string {
  return `${normalizePhone(phone)}:${new Date(start).toISOString()}`;
}

function idempotencyRedisKey(bookingKey: string): string {
  return `${BOOKING_IDEMPOTENCY_PREFIX}${bookingKey}`;
}

async function getBookingIdempotencyRecord(
  bookingKey: string,
): Promise<BookingIdempotencyRecord | null> {
  const redis = getRedis();
  return redis.get<BookingIdempotencyRecord>(idempotencyRedisKey(bookingKey));
}

async function saveBookingIdempotencyRecord(
  bookingKey: string,
  record: BookingIdempotencyRecord,
): Promise<void> {
  const redis = getRedis();
  await redis.set(idempotencyRedisKey(bookingKey), record, {
    ex: BOOKING_IDEMPOTENCY_TTL_SECONDS,
  });
}

function calendarEventsUrl(calendarId: string, params: URLSearchParams): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
}

export type FetchCalendarEventsResult =
  | { ok: true; events: NormalizedCalendarEvent[] }
  | { ok: false; reason: "not_configured" | "calendar_api_error"; detail?: string; status?: number };

export async function fetchCalendarEventsInRange(
  timeMin: string,
  timeMax: string,
): Promise<FetchCalendarEventsResult> {
  if (!(await isGoogleCalendarApiConfigured())) {
    logProviderFailure("not_configured", {
      requestStartIso: timeMin,
      requestEndIso: timeMax,
    });
    return { ok: false, reason: "not_configured" };
  }

  const calendarId = await resolveGoogleCalendarId();
  if (!calendarId) {
    logProviderFailure("not_configured", {
      requestStartIso: timeMin,
      requestEndIso: timeMax,
    });
    return { ok: false, reason: "not_configured" };
  }

  try {
    const token = await getProviderAccessToken();
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "250",
    });

    const response = await fetch(calendarEventsUrl(calendarId, params), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      const apiError = sanitizeGoogleApiErrorBody(text, response.status);
      logProviderFailure("calendar_api", {
        requestEndpoint: "calendar.events.list",
        requestStartIso: timeMin,
        requestEndIso: timeMax,
        tokenGenerationSucceeded: true,
        ...apiError,
      });
      logAppointmentEvent("calendar_api_error", {
        action: "list_events_range",
        status: response.status,
        body: text.slice(0, 200),
      });
      return {
        ok: false,
        reason: "calendar_api_error",
        detail: text.slice(0, 200),
        status: response.status,
      };
    }

    const data = (await response.json()) as { items?: GoogleCalendarApiEvent[] };
    const events: NormalizedCalendarEvent[] = [];

    for (const item of data.items ?? []) {
      const parsed = parseGoogleCalendarApiEvent(item);
      if (parsed) {
        events.push(parsed);
      }
    }

    return { ok: true, events };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProviderFailure(
      message.includes("structurally invalid") || message.includes("credentials are not configured")
        ? "invalid_private_key"
        : message.includes("token exchange failed")
          ? "token_exchange"
          : "calendar_api",
      {
        requestEndpoint: message.includes("token exchange failed")
          ? "oauth2.token"
          : "calendar.events.list",
        requestStartIso: timeMin,
        requestEndIso: timeMax,
        googleErrorMessage: message.slice(0, 240),
      },
    );
    logAppointmentEvent("calendar_api_error", {
      action: "list_events_range",
      error: message,
    });
    return {
      ok: false,
      reason: "calendar_api_error",
      detail: message,
    };
  }
}

export async function getConsultationSlots(
  input: GetConsultationSlotsInput,
): Promise<GetConsultationSlotsResult> {
  if (!(await isGoogleCalendarApiConfigured())) {
    return { ok: false, reason: "not_configured" };
  }

  const rangeStart = new Date(input.rangeStart);
  const rangeEnd = new Date(input.rangeEnd);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return { ok: false, reason: "calendar_api_error", detail: "Invalid date range" };
  }

  try {
    const fetched = await fetchCalendarEventsInRange(
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
    );
    if (!fetched.ok) {
      return { ok: false, reason: fetched.reason, detail: fetched.detail };
    }
    const busy = buildBusyIntervalsFromEvents(fetched.events);
    const slots = selectConsultationSlots(
      {
        rangeStart,
        rangeEnd,
        maxSlots: input.maxSlots,
        now: input.now,
      },
      busy,
    );
    return { ok: true, slots };
  } catch (error) {
    return {
      ok: false,
      reason: "calendar_api_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function isConsultationStartAvailable(start: string, now = new Date()): Promise<boolean> {
  const startDate = new Date(start);
  const durationMinutes = getConsultationDurationMinutes();
  const rangeStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
  const fetched = await fetchCalendarEventsInRange(
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
  );
  if (!fetched.ok) {
    return false;
  }
  const busy = buildBusyIntervalsFromEvents(fetched.events);
  const slots = selectConsultationSlots(
    {
      rangeStart,
      rangeEnd,
      now,
      maxSlots: Number.POSITIVE_INFINITY,
    },
    busy,
  );
  return slots.includes(new Date(start).toISOString());
}

function buildConsultationEventBody(input: CreateConsultationEventInput): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string }>;
  conferenceData: {
    createRequest: ReturnType<typeof buildGoogleMeetConferenceCreateRequest>;
  };
  extendedProperties: { private: Record<string, string> };
} {
  const startDate = new Date(input.start);
  const durationMinutes = getConsultationDurationMinutes();
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const bookingKey = buildConsultationBookingKey(input.phone, input.start);
  const phone = normalizePhone(input.phone);

  const descriptionLines = [
    `Phone: ${phone}`,
    `Source: ${input.source}`,
    input.attendeeEmail?.trim() ? `Email: ${input.attendeeEmail.trim()}` : undefined,
    input.businessName ? `Business: ${input.businessName}` : undefined,
    input.notes ? `Notes: ${input.notes}` : undefined,
  ].filter(Boolean);

  const includeAttendees =
    supportsAttendeeInvites() && Boolean(input.attendeeEmail?.trim());

  return {
    summary: `624Voice AI Consultation - ${input.businessName ?? input.attendeeName}`,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: CONSULTATION_TIMEZONE,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: CONSULTATION_TIMEZONE,
    },
    attendees: includeAttendees ? [{ email: input.attendeeEmail!.trim() }] : undefined,
    conferenceData: {
      createRequest: buildGoogleMeetConferenceCreateRequest(bookingKey),
    },
    extendedProperties: {
      private: {
        s2lSource: input.source,
        s2lPhone: phone,
        s2lBookingKey: bookingKey,
        s2lCreatedBy: "agent",
        ...(input.attendeeEmail?.trim() ? { s2lEmail: input.attendeeEmail.trim() } : {}),
      },
    },
  };
}

/** Service-account provider cannot invite external attendees without domain-wide delegation. */
export function supportsAttendeeInvites(): boolean {
  return false;
}

/** True when attendee email invites are enabled for the active calendar provider. */
export function calendarAttendeeInviteEnabled(attendeeEmail?: string): boolean {
  return supportsAttendeeInvites() && Boolean(attendeeEmail?.trim()) && Boolean(getGoogleCalendarId());
}

export type CalendarInsertDiagnostic = {
  ok: boolean;
  httpStatus?: number;
  googleErrorReason?: string;
  googleErrorMessage?: string;
  requestEndpoint: "calendar.events.insert";
  calendarId?: string;
  sendUpdatesUsed?: string;
  attendeeCount: number;
  attendeeIncluded: boolean;
  conferenceRequested: boolean;
  conferenceStatus?: string;
  eventStartIso?: string;
  eventEndIso?: string;
  eventId?: string;
  googleMeetUrl?: string;
  conferenceSolutionType?: string;
  event?: GoogleCalendarApiEvent;
};

export async function insertCalendarEventWithDiagnostic(
  body: ReturnType<typeof buildConsultationEventBody>,
): Promise<CalendarInsertDiagnostic> {
  const calendarId = await resolveGoogleCalendarId();
  const attendeeCount = body.attendees?.length ?? 0;
  const attendeeIncluded = attendeeCount > 0;
  const conferenceRequested = Boolean(body.conferenceData?.createRequest);
  const conferenceSolutionType =
    body.conferenceData?.createRequest?.conferenceSolutionKey?.type;
  const eventStartIso = body.start.dateTime;
  const eventEndIso = body.end.dateTime;
  const base: CalendarInsertDiagnostic = {
    ok: false,
    requestEndpoint: "calendar.events.insert",
    calendarId: calendarId ?? undefined,
    attendeeCount,
    attendeeIncluded,
    conferenceRequested,
    conferenceSolutionType,
    eventStartIso,
    eventEndIso,
  };

  if (!calendarId) {
    return base;
  }

  const token = await getProviderAccessToken();
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  const sendUpdatesUsed =
    supportsAttendeeInvites() && attendeeIncluded ? "all" : undefined;
  if (sendUpdatesUsed) {
    url.searchParams.set("sendUpdates", sendUpdatesUsed);
  }
  if (conferenceRequested) {
    url.searchParams.set("conferenceDataVersion", "1");
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const apiError = sanitizeGoogleApiErrorBody(text, response.status);
    logAppointmentEvent("calendar_api_error", {
      action: "create_event",
      status: response.status,
      body: text.slice(0, 200),
    });
    logGoogleProviderDiagnostic(
      {
        ...getGoogleServiceAccountCredentialDiagnostics(),
        tokenGenerationSucceeded: true,
        failureStage: "calendar_api",
        requestEndpoint: "calendar.events.insert",
        requestStartIso: eventStartIso,
        requestEndIso: eventEndIso,
        ...apiError,
      },
      {
        sendUpdatesUsed,
        attendeeCount,
        conferenceRequested,
        calendarId,
      },
    );
    return {
      ...base,
      ...apiError,
      sendUpdatesUsed,
    };
  }

  const created = (await response.json()) as GoogleCalendarApiEvent;
  const conferenceStatus = readConferenceStatus(created);
  const googleMeetUrl = extractGoogleMeetUrl(created);
  return {
    ...base,
    ok: true,
    httpStatus: response.status,
    eventId: created.id,
    event: created,
    sendUpdatesUsed,
    conferenceStatus,
    conferenceSolutionType,
    googleMeetUrl,
  };
}

async function insertCalendarEvent(
  body: ReturnType<typeof buildConsultationEventBody>,
): Promise<GoogleCalendarApiEvent | null> {
  const result = await insertCalendarEventWithDiagnostic(body);
  return result.ok ? (result.event ?? null) : null;
}

export async function recheckConsultationStartAvailable(
  start: string,
  now = new Date(),
): Promise<boolean> {
  return isConsultationStartAvailable(start, now);
}

async function fetchCalendarEventById(eventId: string): Promise<GoogleCalendarApiEvent | null> {
  const calendarId = await resolveGoogleCalendarId();
  if (!calendarId) {
    return null;
  }

  const token = await getProviderAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GoogleCalendarApiEvent;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve the canonical Google Meet URL after event insert, with bounded re-read for pending conferences. */
export async function resolveCreatedEventMeetUrl(args: {
  eventId: string;
  initialEvent?: GoogleCalendarApiEvent;
}): Promise<{ meetUrl?: string; conferenceStatus?: string }> {
  let event = args.initialEvent;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!event || attempt > 0) {
      event = (await fetchCalendarEventById(args.eventId)) ?? undefined;
    }
    if (!event) {
      return {};
    }

    const conferenceStatus = readConferenceStatus(event);
    if (isConferenceFailureStatus(conferenceStatus)) {
      return { conferenceStatus: "failure" };
    }

    const meetUrl = extractGoogleMeetUrl(event);
    if (meetUrl) {
      return { meetUrl, conferenceStatus: conferenceStatus ?? "success" };
    }

    if (isConferencePendingStatus(conferenceStatus)) {
      if (attempt < maxAttempts - 1) {
        await sleepMs(250 * (attempt + 1));
        continue;
      }
      return { conferenceStatus };
    }

    return { conferenceStatus };
  }

  return {};
}

export async function createConsultationEvent(
  input: CreateConsultationEventInput,
): Promise<CreateConsultationEventResult> {
  const collector = getActiveBookingStageCollector();
  const calendarId = await resolveGoogleCalendarId();
  const startDate = new Date(input.start);
  const durationMinutes = getConsultationDurationMinutes();
  const eventEndIso = new Date(startDate.getTime() + durationMinutes * 60_000).toISOString();
  const body = buildConsultationEventBody(input);
  const attendeeCount = body.attendees?.length ?? 0;
  const attendeeIncluded = attendeeCount > 0;
  const conferenceRequested = Boolean(body.conferenceData?.createRequest);
  const bookingKey = buildConsultationBookingKey(input.phone, input.start);

  if (collector) {
    collector.createConsultationEventEntered = true;
    collector.selectedStart = input.start;
    collector.attendeeCount = attendeeCount;
    collector.attendeeIncluded = attendeeIncluded;
    collector.conferenceRequested = conferenceRequested;
    collector.calendarId = calendarId ?? undefined;
    collector.bookingKeySuffix = bookingKey.slice(-24);
  }

  if (!(await isGoogleCalendarBookingConfigured())) {
    if (collector) {
      collector.failureStage = "not_configured";
      collector.failureReason = "oauth_not_connected";
      collector.finalBookingReason = "not_configured";
    }
    return { ok: false, reason: "not_configured", detail: "Google OAuth connection is required" };
  }

  if (collector) {
    collector.idempotencyLookupStarted = true;
  }
  let existing: BookingIdempotencyRecord | null = null;
  try {
    existing = await getBookingIdempotencyRecord(bookingKey);
    if (collector) {
      collector.idempotencyLookupResult = existing ? "hit_replayed" : "miss";
    }
  } catch (error) {
    if (collector) {
      collector.idempotencyLookupResult = "error";
      collector.failureStage = "idempotency_error";
      collector.failureReason =
        error instanceof Error ? error.message.slice(0, 120) : "idempotency_lookup_failed";
      collector.finalBookingReason = "idempotency_error";
    }
    throw error;
  }

  if (existing) {
    const apiEvent = await fetchCalendarEventById(existing.eventId);
    const normalizedBase = apiEvent ? parseGoogleCalendarApiEvent(apiEvent) : null;
    const meetUrl =
      normalizedBase?.meetingLink ??
      existing.googleMeetUrl ??
      (apiEvent ? extractGoogleMeetUrl(apiEvent) : undefined);
    const normalized =
      normalizedBase && meetUrl
        ? { ...normalizedBase, meetingLink: meetUrl }
        : normalizedBase;
    if (normalized && meetUrl) {
      if (collector) {
        collector.idempotencyLookupResult = "hit_replayed";
        collector.eventIdPresent = true;
        collector.googleMeetUrlPresent = true;
        collector.conferenceRequested = conferenceRequested;
        collector.createEventResult = "skipped";
        collector.finalBookingReason = "idempotency_replayed";
      }
      return {
        ok: true,
        eventId: existing.eventId,
        normalizedEvent: normalized,
        googleMeetUrl: meetUrl,
        replayed: true,
      };
    }
    if (collector) {
      collector.idempotencyLookupResult = "stale_miss";
    }
  }

  if (collector) {
    collector.recheckStarted = true;
    collector.recheckResult = "started";
  }
  const recheckSucceeded = await isConsultationStartAvailable(input.start, input.now);
  if (collector) {
    collector.recheckResult = recheckSucceeded ? "succeeded" : "failed";
  }
  if (!recheckSucceeded) {
    if (collector) {
      collector.failureStage = "recheck_error";
      collector.failureReason = "slot_unavailable";
      collector.finalBookingReason = "slot_unavailable";
    }
    return {
      ok: false,
      reason: "slot_unavailable",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: false,
        createAttempted: false,
        createSucceeded: false,
        attendeeCount,
        calendarId: calendarId ?? undefined,
        eventStartIso: input.start,
        eventEndIso,
      },
    };
  }

  if (collector) {
    collector.insertCalendarEventAttempted = true;
  }
  const insertResult = await insertCalendarEventWithDiagnostic(body);
  if (collector) {
    collector.insertCalendarEventHttpStatus = insertResult.httpStatus;
    collector.sendUpdatesUsed = insertResult.sendUpdatesUsed;
    collector.conferenceRequested = insertResult.conferenceRequested;
    collector.conferenceStatus = insertResult.conferenceStatus;
    collector.createEventResult = insertResult.ok ? "succeeded" : "failed";
    if (!insertResult.ok) {
      collector.failureStage = "calendar_insert_error";
      collector.failureReason = insertResult.googleErrorReason ?? "calendar_api_error";
      collector.providerErrorReason = insertResult.googleErrorReason;
      collector.providerErrorMessage = insertResult.googleErrorMessage;
      collector.finalBookingReason = "calendar_api_error";
    }
  }
  if (!insertResult.ok || !insertResult.event) {
    return {
      ok: false,
      reason: "calendar_api_error",
      detail: insertResult.googleErrorMessage ?? "Event creation failed",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: true,
        createAttempted: true,
        createSucceeded: false,
        sendUpdatesUsed: insertResult.sendUpdatesUsed,
        attendeeCount: insertResult.attendeeCount,
        attendeeIncluded: insertResult.attendeeIncluded,
        conferenceRequested: insertResult.conferenceRequested,
        conferenceStatus: insertResult.conferenceStatus,
        googleMeetUrlPresent: false,
        calendarId: insertResult.calendarId,
        eventStartIso: insertResult.eventStartIso,
        eventEndIso: insertResult.eventEndIso,
        insertHttpStatus: insertResult.httpStatus,
        googleErrorReason: insertResult.googleErrorReason,
        googleErrorMessage: insertResult.googleErrorMessage,
      },
    };
  }

  const created = insertResult.event;
  const immediateConferenceStatus = readConferenceStatus(created);
  if (isConferenceFailureStatus(immediateConferenceStatus)) {
    if (collector) {
      collector.failureStage = "conference_creation_error";
      collector.failureReason = "conference_create_failed";
      collector.finalBookingReason = "conference_error";
      collector.createEventResult = "failed";
      collector.conferenceStatus = immediateConferenceStatus;
    }
    return {
      ok: false,
      reason: "conference_error",
      detail: "Google Meet conference creation failed",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: true,
        createAttempted: true,
        createSucceeded: true,
        sendUpdatesUsed: insertResult.sendUpdatesUsed,
        attendeeCount: insertResult.attendeeCount,
        attendeeIncluded: insertResult.attendeeIncluded,
        conferenceRequested: insertResult.conferenceRequested,
        conferenceStatus: immediateConferenceStatus,
        googleMeetUrlPresent: false,
        calendarId: insertResult.calendarId,
        eventStartIso: insertResult.eventStartIso,
        eventEndIso: insertResult.eventEndIso,
        insertHttpStatus: insertResult.httpStatus,
      },
    };
  }

  const meetResolution = await resolveCreatedEventMeetUrl({
    eventId: created.id!,
    initialEvent: created,
  });
  const googleMeetUrl = meetResolution.meetUrl ?? insertResult.googleMeetUrl;
  if (collector) {
    collector.conferenceStatus = meetResolution.conferenceStatus ?? insertResult.conferenceStatus;
    collector.googleMeetUrlPresent = Boolean(googleMeetUrl);
  }
  if (!googleMeetUrl) {
    if (collector) {
      collector.failureStage = "conference_creation_error";
      collector.failureReason =
        meetResolution.conferenceStatus === "failure"
          ? "conference_create_failed"
          : meetResolution.conferenceStatus ?? "meet_url_missing";
      collector.finalBookingReason = "conference_error";
      collector.createEventResult = "failed";
    }
    return {
      ok: false,
      reason: "conference_error",
      detail: "Google Meet link was not returned for the created event",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: true,
        createAttempted: true,
        createSucceeded: true,
        sendUpdatesUsed: insertResult.sendUpdatesUsed,
        attendeeCount: insertResult.attendeeCount,
        attendeeIncluded: insertResult.attendeeIncluded,
        conferenceRequested: insertResult.conferenceRequested,
        conferenceStatus: meetResolution.conferenceStatus ?? insertResult.conferenceStatus,
        googleMeetUrlPresent: false,
        calendarId: insertResult.calendarId,
        eventStartIso: insertResult.eventStartIso,
        eventEndIso: insertResult.eventEndIso,
        insertHttpStatus: insertResult.httpStatus,
      },
    };
  }

  const normalizedEvent = parseGoogleCalendarApiEvent(created);
  if (!normalizedEvent) {
    if (collector) {
      collector.failureStage = "parse_failed";
      collector.failureReason = "created_event_parse_failed";
      collector.finalBookingReason = "calendar_api_error";
      collector.createEventResult = "failed";
    }
    return {
      ok: false,
      reason: "calendar_api_error",
      detail: "Created event could not be parsed",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: true,
        createAttempted: true,
        createSucceeded: true,
        sendUpdatesUsed: insertResult.sendUpdatesUsed,
        attendeeCount: insertResult.attendeeCount,
        attendeeIncluded: insertResult.attendeeIncluded,
        conferenceRequested: insertResult.conferenceRequested,
        conferenceStatus: meetResolution.conferenceStatus ?? insertResult.conferenceStatus,
        googleMeetUrlPresent: true,
        calendarId: insertResult.calendarId,
        eventStartIso: insertResult.eventStartIso,
        eventEndIso: insertResult.eventEndIso,
        insertHttpStatus: insertResult.httpStatus,
      },
    };
  }

  const normalizedWithMeet: NormalizedCalendarEvent = {
    ...normalizedEvent,
    meetingLink: googleMeetUrl,
  };

  if (collector) {
    collector.persistenceAttempted = true;
  }
  try {
    await saveBookingIdempotencyRecord(bookingKey, {
      eventId: created.id!,
      start: normalizedWithMeet.appointmentStart,
      phone: normalizePhone(input.phone),
      googleMeetUrl,
      createdAt: new Date().toISOString(),
    });
    if (collector) {
      collector.persistenceResult = "succeeded";
      collector.eventIdPresent = true;
      collector.finalBookingReason = "booked";
    }
  } catch (error) {
    if (collector) {
      collector.persistenceResult = "failed";
      collector.failureStage = "persistence_error";
      collector.failureReason =
        error instanceof Error ? error.message.slice(0, 120) : "persistence_failed";
      collector.finalBookingReason = "persistence_error";
    }
    throw error;
  }

  return {
    ok: true,
    eventId: created.id!,
    normalizedEvent: normalizedWithMeet,
    googleMeetUrl,
    replayed: false,
  };
}

/** Test helper: verify a slot against explicit busy intervals without API calls. */
export function isStartAvailableAgainstBusy(
  start: string,
  busyIntervals: BusyInterval[],
  durationMinutes = getConsultationDurationMinutes(),
  bufferMinutes?: number,
): boolean {
  const startMs = new Date(start).getTime();
  const expanded = expandBusyIntervals(busyIntervals, bufferMinutes ?? 10);
  return isSlotAvailable(startMs, durationMinutes, expanded);
}
