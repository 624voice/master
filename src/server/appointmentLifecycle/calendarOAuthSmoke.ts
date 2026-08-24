import { probeHandsetEquivalentBookProviderSlot } from "~/server/appointmentLifecycle/googleBookingProviderProbe";
import {
  classifyCalendarCapability,
  type CalendarCapabilityCase,
} from "~/server/appointmentLifecycle/calendarCapabilityProbe";
import { getGoogleOAuthConfigurationDiagnostics } from "~/server/appointmentLifecycle/googleOAuthConfig";
import {
  getGoogleCalendarAuthContext,
  getGoogleCalendarProviderAccessToken,
  getSanitizedOAuthConnectionStatus,
  isGoogleOAuthConnectionActive,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import { sanitizeOAuthConnection } from "~/server/appointmentLifecycle/googleOAuthStore";
import { sanitizeGoogleApiErrorBody } from "~/server/appointmentLifecycle/googleCredentials";
import { resolveGoogleCalendarId } from "~/server/appointmentLifecycle/config";

type GoogleCalendarResource = {
  id?: string;
  summary?: string;
  timeZone?: string;
  dataOwner?: string;
  conferenceProperties?: { allowedConferenceSolutionTypes?: string[] };
};

type GoogleCalendarListEntry = GoogleCalendarResource & {
  accessRole?: string;
  primary?: boolean;
};

export type CalendarOAuthSmokeResult = {
  ok: boolean;
  mode: "oauth_calendar_smoke";
  oauthClientConfigured: boolean;
  connection: ReturnType<typeof sanitizeOAuthConnection>;
  auth: Awaited<ReturnType<typeof getGoogleCalendarAuthContext>>;
  capability: {
    calendarsGet: {
      httpStatus: number;
      calendarId?: string;
      allowedConferenceSolutionTypes?: string[] | null;
      conferenceProperties?: { allowedConferenceSolutionTypes?: string[] } | null;
    };
    calendarListGet: {
      httpStatus: number;
      present: boolean;
      accessRole?: string;
      allowedConferenceSolutionTypes?: string[] | null;
    };
    classification: CalendarCapabilityCase;
    meetCreationLikelySupported: boolean;
  };
  booking?: Awaited<ReturnType<typeof probeHandsetEquivalentBookProviderSlot>>;
  configurationError?: "oauth_not_connected" | "oauth_client_not_configured";
};

async function fetchGoogleJson<T>(url: string, accessToken: string): Promise<{
  httpStatus: number;
  body: T | string;
}> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  if (!response.ok) {
    return { httpStatus: response.status, body: text };
  }
  try {
    return { httpStatus: response.status, body: JSON.parse(text) as T };
  } catch {
    return { httpStatus: response.status, body: text };
  }
}

export async function probeOAuthCalendarSmoke(args?: {
  start?: string;
  includeBooking?: boolean;
  cleanup?: boolean;
}): Promise<CalendarOAuthSmokeResult> {
  const oauthDiagnostics = getGoogleOAuthConfigurationDiagnostics();
  const connectionStatus = await getSanitizedOAuthConnectionStatus();
  const auth = await getGoogleCalendarAuthContext();

  const base: CalendarOAuthSmokeResult = {
    ok: false,
    mode: "oauth_calendar_smoke",
    oauthClientConfigured: oauthDiagnostics.clientConfigured,
    connection: connectionStatus,
    auth,
    capability: {
      calendarsGet: { httpStatus: 0 },
      calendarListGet: { httpStatus: 0, present: false },
      classification: "CASE_C",
      meetCreationLikelySupported: false,
    },
  };

  if (!oauthDiagnostics.clientConfigured) {
    return { ...base, configurationError: "oauth_client_not_configured" };
  }

  if (!(await isGoogleOAuthConnectionActive())) {
    return { ...base, configurationError: "oauth_not_connected" };
  }

  const calendarId = await resolveGoogleCalendarId();
  if (!calendarId) {
    return { ...base, configurationError: "oauth_not_connected" };
  }

  const accessToken = await getGoogleCalendarProviderAccessToken();
  const [calendarsGetResponse, calendarListResponse] = await Promise.all([
    fetchGoogleJson<GoogleCalendarResource>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      accessToken,
    ),
    fetchGoogleJson<GoogleCalendarListEntry>(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      accessToken,
    ),
  ]);

  const calendarsBody =
    typeof calendarsGetResponse.body === "string" ? undefined : calendarsGetResponse.body;
  const calendarListBody =
    typeof calendarListResponse.body === "string" ? undefined : calendarListResponse.body;

  const calendarsGet = {
    httpStatus: calendarsGetResponse.httpStatus,
    calendarId: calendarsBody?.id,
    allowedConferenceSolutionTypes:
      calendarsBody?.conferenceProperties?.allowedConferenceSolutionTypes ?? null,
    conferenceProperties: calendarsBody?.conferenceProperties ?? null,
  };

  const calendarListGet = {
    httpStatus: calendarListResponse.httpStatus,
    present: calendarListResponse.httpStatus === 200,
    accessRole: calendarListBody?.accessRole,
    allowedConferenceSolutionTypes:
      calendarListBody?.conferenceProperties?.allowedConferenceSolutionTypes ?? null,
  };

  const classification = classifyCalendarCapability(
    calendarsGet.httpStatus === 200
      ? calendarsGet
      : calendarListGet.present
        ? calendarListGet
        : calendarsGet,
  );

  const capability = {
    calendarsGet,
    calendarListGet,
    classification,
    meetCreationLikelySupported: classification === "CASE_A",
  };

  let booking: CalendarOAuthSmokeResult["booking"];
  if (args?.includeBooking !== false) {
    booking = await probeHandsetEquivalentBookProviderSlot({
      start: args?.start,
      cleanup: args?.cleanup,
    });
  }

  const bookingOk = booking ? booking.ok : true;
  const ok =
    auth.mode === "oauth_user" &&
    auth.oauthConnected &&
    capability.meetCreationLikelySupported &&
    bookingOk;

  return {
    ...base,
    ok,
    auth: await getGoogleCalendarAuthContext(),
    capability,
    booking,
  };
}

export function sanitizeOAuthSmokeForResponse(result: CalendarOAuthSmokeResult): CalendarOAuthSmokeResult {
  return JSON.parse(JSON.stringify(result)) as CalendarOAuthSmokeResult;
}

export function extractOAuthSmokeHttpError(result: CalendarOAuthSmokeResult): string | undefined {
  if (typeof result.capability.calendarsGet.httpStatus === "number" && result.capability.calendarsGet.httpStatus >= 400) {
    return sanitizeGoogleApiErrorBody(String(result.capability.calendarsGet.httpStatus)).googleErrorMessage;
  }
  return undefined;
}
