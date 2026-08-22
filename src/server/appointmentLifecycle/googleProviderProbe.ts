import { createSign } from "node:crypto";
import { getGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBusyIntervalsFromEvents,
  selectConsultationSlots,
} from "~/server/appointmentLifecycle/consultationSlots";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  getGoogleServiceAccountCredentials,
  isGoogleCalendarApiConfigured,
  isGooglePrivateKeyStructurallyValid,
  logGoogleProviderDiagnostic,
  sanitizeGoogleApiErrorBody,
  type GoogleProviderDiagnostic,
} from "~/server/appointmentLifecycle/googleCredentials";
import { parseGoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

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

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function exchangeServiceAccountToken(
  clientEmail: string,
  privateKey: string,
): Promise<
  | { ok: true; accessToken: string }
  | { ok: false; httpStatus: number; body: string; signError?: string }
> {
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
    return {
      ok: false,
      httpStatus: 0,
      body: "",
      signError: error instanceof Error ? error.message.slice(0, 240) : String(error),
    };
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
    return { ok: false, httpStatus: response.status, body: await response.text() };
  }

  const data = (await response.json()) as { access_token: string };
  return { ok: true, accessToken: data.access_token };
}

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

  if (!isGoogleCalendarApiConfigured()) {
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      failureStage: "not_configured",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  let credentials: { clientEmail: string; privateKey: string };
  try {
    credentials = getGoogleServiceAccountCredentials();
  } catch {
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      failureStage: "invalid_private_key",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  if (!isGooglePrivateKeyStructurallyValid(credentials.privateKey)) {
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      failureStage: "invalid_private_key",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  const tokenExchange = await exchangeServiceAccountToken(
    credentials.clientEmail,
    credentials.privateKey,
  );
  if (!tokenExchange.ok) {
    const apiError = tokenExchange.body
      ? sanitizeGoogleApiErrorBody(tokenExchange.body, tokenExchange.httpStatus || undefined)
      : {
          httpStatus: tokenExchange.httpStatus || undefined,
          googleErrorMessage: tokenExchange.signError,
        };
    const diagnostic: GoogleProviderProbeResult = {
      ...base,
      ...apiError,
      failureStage: tokenExchange.signError ? "invalid_private_key" : "token_exchange",
      requestEndpoint: "oauth2.token",
    };
    logGoogleProviderDiagnostic(diagnostic);
    return diagnostic;
  }

  const calendarId = getGoogleCalendarId();
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
    headers: { Authorization: `Bearer ${tokenExchange.accessToken}` },
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
