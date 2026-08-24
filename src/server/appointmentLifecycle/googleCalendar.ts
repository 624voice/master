import { createSign } from "node:crypto";
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
} from "~/server/appointmentLifecycle/config";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  getGoogleServiceAccountCredentials,
  logGoogleProviderDiagnostic,
  sanitizeGoogleApiErrorBody,
} from "~/server/appointmentLifecycle/googleCredentials";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  parseGoogleCalendarApiEvent,
  type GoogleCalendarApiEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import type { NormalizedCalendarEvent, S2LSource } from "~/server/appointmentLifecycle/types";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

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

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  let credentials: { clientEmail: string; privateKey: string };
  try {
    credentials = getGoogleServiceAccountCredentials();
  } catch (error) {
    logProviderFailure("invalid_private_key", {
      requestEndpoint: "oauth2.token",
      googleErrorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error),
    });
    throw error;
  }

  const { clientEmail, privateKey } = credentials;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const unsigned = `${header}.${claim}`;
  let assertion = "";
  try {
    const sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    sign.end();
    assertion = `${unsigned}.${base64url(sign.sign(privateKey))}`;
  } catch (error) {
    logProviderFailure("invalid_private_key", {
      requestEndpoint: "oauth2.token",
      googleErrorMessage: error instanceof Error ? error.message.slice(0, 240) : String(error),
    });
    throw error;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const apiError = sanitizeGoogleApiErrorBody(text, response.status);
    logProviderFailure("token_exchange", {
      requestEndpoint: "oauth2.token",
      ...apiError,
    });
    throw new Error(`Google token exchange failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

export async function fetchCalendarEventsUpdatedSince(
  updatedMin: string,
): Promise<NormalizedCalendarEvent[]> {
  if (!isGoogleCalendarApiConfigured()) {
    return [];
  }

  const calendarId = getGoogleCalendarId();
  if (!calendarId) {
    return [];
  }

  try {
    const token = await getAccessToken();
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
  if (!isGoogleCalendarApiConfigured()) {
    return false;
  }

  const calendarId = getGoogleCalendarId();
  if (!calendarId) {
    return false;
  }

  try {
    const token = await getAccessToken();
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
  cachedToken = null;
}

const BOOKING_IDEMPOTENCY_PREFIX = "appointment:booking:idempotency:";
const BOOKING_IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 7;

type BookingIdempotencyRecord = {
  eventId: string;
  start: string;
  phone: string;
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
  replayed: boolean;
};

export type ConsultationBookingFailureDiagnostics = {
  recheckSucceeded: boolean;
  recheckAttempted: boolean;
  createAttempted: boolean;
  createSucceeded: boolean;
  sendUpdatesUsed?: string;
  attendeeCount: number;
  calendarId?: string;
  eventStartIso?: string;
  eventEndIso?: string;
  insertHttpStatus?: number;
  googleErrorReason?: string;
  googleErrorMessage?: string;
};

export type CreateConsultationEventFailure = {
  ok: false;
  reason: "not_configured" | "slot_unavailable" | "calendar_api_error";
  detail?: string;
  diagnostics?: ConsultationBookingFailureDiagnostics;
};

export type CreateConsultationEventResult =
  | CreateConsultationEventSuccess
  | CreateConsultationEventFailure;

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
  if (!isGoogleCalendarApiConfigured()) {
    logProviderFailure("not_configured", {
      requestStartIso: timeMin,
      requestEndIso: timeMax,
    });
    return { ok: false, reason: "not_configured" };
  }

  const calendarId = getGoogleCalendarId();
  if (!calendarId) {
    logProviderFailure("not_configured", {
      requestStartIso: timeMin,
      requestEndIso: timeMax,
    });
    return { ok: false, reason: "not_configured" };
  }

  try {
    const token = await getAccessToken();
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
  if (!isGoogleCalendarApiConfigured()) {
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
    input.businessName ? `Business: ${input.businessName}` : undefined,
    input.notes ? `Notes: ${input.notes}` : undefined,
  ].filter(Boolean);

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
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    extendedProperties: {
      private: {
        s2lSource: input.source,
        s2lPhone: phone,
        s2lBookingKey: bookingKey,
        s2lCreatedBy: "agent",
      },
    },
  };
}

/** True when attendee email invites are requested on calendar event creation. */
export function calendarAttendeeInviteEnabled(attendeeEmail?: string): boolean {
  return Boolean(attendeeEmail?.trim()) && isGoogleCalendarApiConfigured();
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
  eventStartIso?: string;
  eventEndIso?: string;
  eventId?: string;
  event?: GoogleCalendarApiEvent;
};

export async function insertCalendarEventWithDiagnostic(
  body: ReturnType<typeof buildConsultationEventBody>,
): Promise<CalendarInsertDiagnostic> {
  const calendarId = getGoogleCalendarId();
  const attendeeCount = body.attendees?.length ?? 0;
  const eventStartIso = body.start.dateTime;
  const eventEndIso = body.end.dateTime;
  const base: CalendarInsertDiagnostic = {
    ok: false,
    requestEndpoint: "calendar.events.insert",
    calendarId: calendarId ?? undefined,
    attendeeCount,
    eventStartIso,
    eventEndIso,
  };

  if (!calendarId) {
    return base;
  }

  const token = await getAccessToken();
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  const sendUpdatesUsed = body.attendees?.length ? "all" : undefined;
  if (sendUpdatesUsed) {
    url.searchParams.set("sendUpdates", sendUpdatesUsed);
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
  return {
    ...base,
    ok: true,
    httpStatus: response.status,
    eventId: created.id,
    event: created,
    sendUpdatesUsed,
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
  const calendarId = getGoogleCalendarId();
  if (!calendarId) {
    return null;
  }

  const token = await getAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GoogleCalendarApiEvent;
}

export async function createConsultationEvent(
  input: CreateConsultationEventInput,
): Promise<CreateConsultationEventResult> {
  const calendarId = getGoogleCalendarId();
  const startDate = new Date(input.start);
  const durationMinutes = getConsultationDurationMinutes();
  const eventEndIso = new Date(startDate.getTime() + durationMinutes * 60_000).toISOString();
  const body = buildConsultationEventBody(input);
  const attendeeCount = body.attendees?.length ?? 0;

  if (!isGoogleCalendarApiConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const bookingKey = buildConsultationBookingKey(input.phone, input.start);
  const existing = await getBookingIdempotencyRecord(bookingKey);
  if (existing) {
    const apiEvent = await fetchCalendarEventById(existing.eventId);
    const normalized = apiEvent ? parseGoogleCalendarApiEvent(apiEvent) : null;
    if (normalized) {
      return {
        ok: true,
        eventId: existing.eventId,
        normalizedEvent: normalized,
        replayed: true,
      };
    }
  }

  const recheckSucceeded = await isConsultationStartAvailable(input.start, input.now);
  if (!recheckSucceeded) {
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

  const insertResult = await insertCalendarEventWithDiagnostic(body);
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
  const normalizedEvent = parseGoogleCalendarApiEvent(created);
  if (!normalizedEvent) {
    return {
      ok: false,
      reason: "calendar_api_error",
      detail: "Created event could not be parsed",
      diagnostics: {
        recheckAttempted: true,
        recheckSucceeded: true,
        createAttempted: true,
        createSucceeded: false,
        sendUpdatesUsed: insertResult.sendUpdatesUsed,
        attendeeCount: insertResult.attendeeCount,
        calendarId: insertResult.calendarId,
        eventStartIso: insertResult.eventStartIso,
        eventEndIso: insertResult.eventEndIso,
        insertHttpStatus: insertResult.httpStatus,
      },
    };
  }

  await saveBookingIdempotencyRecord(bookingKey, {
    eventId: created.id!,
    start: normalizedEvent.appointmentStart,
    phone: normalizePhone(input.phone),
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    eventId: created.id!,
    normalizedEvent,
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
