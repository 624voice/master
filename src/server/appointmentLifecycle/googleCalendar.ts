import { createSign } from "node:crypto";
import {
  getGoogleCalendarId,
  isGoogleCalendarApiConfigured,
} from "~/server/appointmentLifecycle/config";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  parseGoogleCalendarApiEvent,
  type GoogleCalendarApiEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import type { NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";

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

function serviceAccountCredentials(): {
  clientEmail: string;
  privateKey: string;
} {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Google service account credentials are not configured");
  }
  return { clientEmail: email, privateKey: key };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const { clientEmail, privateKey } = serviceAccountCredentials();
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
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = base64url(sign.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

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
