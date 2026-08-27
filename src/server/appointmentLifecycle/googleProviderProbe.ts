import { getGoogleCalendarId, isGoogleCalendarApiConfigured, resolveGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBusyIntervalsFromEvents,
  selectConsultationSlots,
} from "~/server/appointmentLifecycle/consultationSlots";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  logGoogleProviderDiagnostic,
  sanitizeGoogleApiErrorBody,
  type GoogleProviderDiagnostic,
} from "~/server/appointmentLifecycle/googleCredentials";
import {
  getGoogleCalendarProviderAccessToken,
  GoogleCalendarAuthError,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import { parseGoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";

type ProbeInput = {
  rangeStart: string;
  rangeEnd: string;
  maxSlots?: number;
  now?: Date;
};

export type GoogleProviderProbeResult = GoogleProviderDiagnostic & {
  ok: boolean;
  busyIntervals: Array<{ start: string; end: string }>;
  availableSlots: string[];
  rawEventCount: number;
};

export async function probeGoogleCalendarProvider(
  input: ProbeInput,
): Promise<GoogleProviderProbeResult> {
  const credentialDiagnostics = getGoogleServiceAccountCredentialDiagnostics();
  const base: GoogleProviderProbeResult = {
    ...credentialDiagnostics,
    tokenGenerationSucceeded: false,
    ok: false,
    busyIntervals: [],
    availableSlots: [],
    rawEventCount: 0,
    requestStartIso: input.rangeStart,
    requestEndIso: input.rangeEnd,
  };

  if (!(await isGoogleCalendarApiConfigured())) {
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      failureStage: "not_configured",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  let accessToken = "";
  try {
    accessToken = await getGoogleCalendarProviderAccessToken();
  } catch (error) {
    const detail = error instanceof GoogleCalendarAuthError ? error.detail ?? error.message : String(error);
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      failureStage:
        error instanceof GoogleCalendarAuthError && error.stage === "oauth_not_connected"
          ? "not_configured"
          : "token_exchange",
      requestEndpoint: "oauth2.token",
      googleErrorMessage: detail.slice(0, 240),
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  const calendarId = (await resolveGoogleCalendarId()) ?? getGoogleCalendarId();
  if (!calendarId) {
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      tokenGenerationSucceeded: true,
      failureStage: "not_configured",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: input.rangeStart,
    timeMax: input.rangeEnd,
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    const apiError = sanitizeGoogleApiErrorBody(body, response.status);
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      ...apiError,
      tokenGenerationSucceeded: true,
      failureStage: "calendar_api",
      requestEndpoint: "calendar.events.list",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  const data = (await response.json()) as { items?: Array<Record<string, unknown>> };
  const events = (data.items ?? [])
    .map((item) => parseGoogleCalendarApiEvent(item))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  const busy = buildBusyIntervalsFromEvents(events);
  const slots = selectConsultationSlots(
    {
      rangeStart: new Date(input.rangeStart),
      rangeEnd: new Date(input.rangeEnd),
      maxSlots: input.maxSlots ?? 12,
      now: input.now,
    },
    busy,
  );

  const diagnostic: GoogleProviderProbeResult = {
    ...base,
    tokenGenerationSucceeded: true,
    ok: true,
    busyIntervals: busy.map((interval) => ({
      start: new Date(interval.startMs).toISOString(),
      end: new Date(interval.endMs).toISOString(),
    })),
    availableSlots: slots,
    rawEventCount: events.length,
    requestEndpoint: "calendar.events.list",
  };
  logGoogleProviderDiagnostic(diagnostic);
  return diagnostic;
}

export { CONSULTATION_TIMEZONE };
