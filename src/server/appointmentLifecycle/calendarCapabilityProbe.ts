import { getGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  isGoogleServiceAccountCalendarConfigured,
  sanitizeGoogleApiErrorBody,
} from "~/server/appointmentLifecycle/googleCredentials";
import {
  getGoogleCalendarAuthContext,
  getGoogleCalendarProviderAccessToken,
} from "~/server/appointmentLifecycle/googleCalendarAuth";

/** JWT claim keys used by the booking provider token exchange (no user impersonation). */
export const GOOGLE_CALENDAR_PROVIDER_JWT_CLAIM_KEYS = [
  "iss",
  "scope",
  "aud",
  "iat",
  "exp",
] as const;

export type CalendarCapabilityCase = "CASE_A" | "CASE_B" | "CASE_C";

export type SanitizedCalendarResource = {
  httpStatus: number;
  calendarId?: string;
  summary?: string;
  timeZone?: string;
  dataOwner?: string | null;
  conferenceProperties?: { allowedConferenceSolutionTypes?: string[] } | null;
  allowedConferenceSolutionTypes?: string[] | null;
  googleErrorReason?: string;
  googleErrorMessage?: string;
};

export type SanitizedCalendarListEntry = {
  httpStatus: number;
  present: boolean;
  calendarId?: string;
  summary?: string;
  accessRole?: string;
  primary?: boolean | null;
  dataOwner?: string | null;
  conferenceProperties?: { allowedConferenceSolutionTypes?: string[] } | null;
  allowedConferenceSolutionTypes?: string[] | null;
  googleErrorReason?: string;
  googleErrorMessage?: string;
};

export type CalendarCapabilityProbeResult = {
  ok: boolean;
  authContext: {
    serviceAccountEmail: string | null;
    actingAs: string;
    impersonatingUser: false;
    calendarId: string | null;
    oauthScope: string;
    jwtClaimKeys: readonly string[];
    jwtHasSubClaim: false;
  };
  calendarsGet: SanitizedCalendarResource;
  calendarListGet: SanitizedCalendarListEntry;
  classification: CalendarCapabilityCase;
  configurationError?: "not_configured";
};

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

type GoogleCalendarResource = {
  id?: string;
  summary?: string;
  timeZone?: string;
  dataOwner?: string;
  conferenceProperties?: {
    allowedConferenceSolutionTypes?: string[];
  };
};

type GoogleCalendarListEntry = GoogleCalendarResource & {
  accessRole?: string;
  primary?: boolean;
};

function sanitizeCalendarResource(
  httpStatus: number,
  body: GoogleCalendarResource | string,
  apiError?: ReturnType<typeof sanitizeGoogleApiErrorBody>,
): SanitizedCalendarResource {
  if (typeof body === "string" || !body || httpStatus >= 400) {
    return {
      httpStatus,
      googleErrorReason: apiError?.googleErrorReason,
      googleErrorMessage: apiError?.googleErrorMessage,
    };
  }

  const allowed = body.conferenceProperties?.allowedConferenceSolutionTypes ?? null;
  return {
    httpStatus,
    calendarId: body.id,
    summary: body.summary,
    timeZone: body.timeZone,
    dataOwner: body.dataOwner ?? null,
    conferenceProperties: body.conferenceProperties
      ? { allowedConferenceSolutionTypes: allowed ?? undefined }
      : null,
    allowedConferenceSolutionTypes: allowed,
  };
}

function sanitizeCalendarListEntry(
  httpStatus: number,
  body: GoogleCalendarListEntry | string,
  apiError?: ReturnType<typeof sanitizeGoogleApiErrorBody>,
): SanitizedCalendarListEntry {
  if (httpStatus === 404) {
    return {
      httpStatus,
      present: false,
      googleErrorReason: apiError?.googleErrorReason ?? "notFound",
      googleErrorMessage: "Calendar is not present in the service account calendar list",
    };
  }

  if (typeof body === "string" || !body || httpStatus >= 400) {
    return {
      httpStatus,
      present: false,
      googleErrorReason: apiError?.googleErrorReason,
      googleErrorMessage: apiError?.googleErrorMessage,
    };
  }

  const allowed = body.conferenceProperties?.allowedConferenceSolutionTypes ?? null;
  return {
    httpStatus,
    present: true,
    calendarId: body.id,
    summary: body.summary,
    accessRole: body.accessRole,
    primary: body.primary ?? null,
    dataOwner: body.dataOwner ?? null,
    conferenceProperties: body.conferenceProperties
      ? { allowedConferenceSolutionTypes: allowed ?? undefined }
      : null,
    allowedConferenceSolutionTypes: allowed,
  };
}

export function classifyCalendarCapability(args: {
  allowedConferenceSolutionTypes?: string[] | null;
  conferenceProperties?: { allowedConferenceSolutionTypes?: string[] } | null;
}): CalendarCapabilityCase {
  const types =
    args.allowedConferenceSolutionTypes ??
    args.conferenceProperties?.allowedConferenceSolutionTypes ??
    null;

  if (!args.conferenceProperties || types == null || types.length === 0) {
    return "CASE_C";
  }
  if (types.includes("hangoutsMeet")) {
    return "CASE_A";
  }
  return "CASE_B";
}

async function fetchGoogleCalendarJson<T extends GoogleCalendarResource>(
  url: string,
  accessToken: string,
): Promise<{ httpStatus: number; body: T | string; apiError?: ReturnType<typeof sanitizeGoogleApiErrorBody> }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      httpStatus: response.status,
      body: text,
      apiError: sanitizeGoogleApiErrorBody(text, response.status),
    };
  }
  try {
    return {
      httpStatus: response.status,
      body: JSON.parse(text) as GoogleCalendarResource,
    };
  } catch {
    return {
      httpStatus: response.status,
      body: text,
      apiError: { httpStatus: response.status, googleErrorMessage: "Invalid JSON response" },
    };
  }
}

/** Read-only Calendar capability probe using the booking provider auth path. */
export async function probeGoogleCalendarCapability(): Promise<CalendarCapabilityProbeResult> {
  const credentialDiagnostics = getGoogleServiceAccountCredentialDiagnostics();
  const calendarId = getGoogleCalendarId() ?? null;

  const authContext: CalendarCapabilityProbeResult["authContext"] = {
    serviceAccountEmail: credentialDiagnostics.serviceAccountEmail,
    actingAs: "service_account_itself",
    impersonatingUser: false,
    calendarId,
    oauthScope: CALENDAR_SCOPE,
    jwtClaimKeys: [...GOOGLE_CALENDAR_PROVIDER_JWT_CLAIM_KEYS],
    jwtHasSubClaim: false,
  };

  if (!isGoogleServiceAccountCalendarConfigured() || !calendarId) {
    return {
      ok: false,
      authContext,
      calendarsGet: { httpStatus: 0 },
      calendarListGet: { httpStatus: 0, present: false },
      classification: "CASE_C",
      configurationError: "not_configured",
    };
  }

  const providerAuth = await getGoogleCalendarAuthContext({ allowServiceAccount: true });
  authContext.actingAs = providerAuth.actingAs;

  const accessToken = await getGoogleCalendarProviderAccessToken({ allowServiceAccount: true });

  const calendarsGetUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;
  const calendarListUrl = `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`;

  const [calendarsGetResponse, calendarListResponse] = await Promise.all([
    fetchGoogleCalendarJson<GoogleCalendarResource>(calendarsGetUrl, accessToken),
    fetchGoogleCalendarJson<GoogleCalendarListEntry>(calendarListUrl, accessToken),
  ]);

  const calendarsGet = sanitizeCalendarResource(
    calendarsGetResponse.httpStatus,
    calendarsGetResponse.body,
    calendarsGetResponse.apiError,
  );
  const calendarListGet = sanitizeCalendarListEntry(
    calendarListResponse.httpStatus,
    calendarListResponse.body,
    calendarListResponse.apiError,
  );

  const classificationSource =
    calendarsGet.httpStatus === 200
      ? calendarsGet
      : calendarListGet.present
        ? calendarListGet
        : calendarsGet;

  const classification = classifyCalendarCapability(classificationSource);

  return {
    ok: calendarsGet.httpStatus === 200 || calendarListGet.present,
    authContext,
    calendarsGet,
    calendarListGet,
    classification,
  };
}
