import { createSign } from "node:crypto";
import { getGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  getGoogleServiceAccountCredentials,
  isGooglePrivateKeyStructurallyValid,
} from "~/server/appointmentLifecycle/googleCredentials";
import {
  getGoogleOAuthAccessToken,
  type GoogleOAuthRefreshResult,
} from "~/server/appointmentLifecycle/googleOAuthFlow";
import {
  getOAuthConnection,
  sanitizeOAuthConnection,
  type SanitizedGoogleOAuthConnection,
} from "~/server/appointmentLifecycle/googleOAuthStore";
import { getGoogleOAuthConnectionId } from "~/server/appointmentLifecycle/googleOAuthConfig";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export type GoogleCalendarAuthMode = "oauth_user" | "service_account";

export type GoogleCalendarAuthContext = {
  mode: GoogleCalendarAuthMode;
  actingAs: string;
  impersonatingUser: boolean;
  calendarId: string | null;
  oauthConnected: boolean;
  jwtHasSubClaim: false;
  oauthScope?: string;
  jwtClaimKeys?: readonly string[];
};

export type GoogleCalendarAuthErrorStage =
  | "oauth_not_connected"
  | "oauth_refresh_failed"
  | "service_account_not_configured"
  | "token_exchange";

export class GoogleCalendarAuthError extends Error {
  readonly stage: GoogleCalendarAuthErrorStage;
  readonly detail?: string;

  constructor(stage: GoogleCalendarAuthErrorStage, detail?: string) {
    super(detail ?? stage);
    this.stage = stage;
    this.detail = detail;
  }
}

let cachedServiceAccountToken: { accessToken: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function isGoogleServiceAccountConfigured(): boolean {
  try {
    getGoogleServiceAccountCredentials();
    return Boolean(getGoogleCalendarId());
  } catch {
    return false;
  }
}

export async function isGoogleOAuthConnectionActive(
  connectionId = getGoogleOAuthConnectionId(),
): Promise<boolean> {
  const connection = await getOAuthConnection(connectionId);
  return Boolean(connection?.refreshToken);
}

export async function isGoogleCalendarBookingConfigured(): Promise<boolean> {
  return isGoogleOAuthConnectionActive();
}

export async function getSanitizedOAuthConnectionStatus(): Promise<SanitizedGoogleOAuthConnection> {
  const connection = await getOAuthConnection();
  return sanitizeOAuthConnection(connection);
}

export async function resolveGoogleCalendarAuthMode(args?: {
  allowServiceAccount?: boolean;
}): Promise<GoogleCalendarAuthMode> {
  if (await isGoogleOAuthConnectionActive()) {
    return "oauth_user";
  }
  if (args?.allowServiceAccount && isGoogleServiceAccountConfigured()) {
    return "service_account";
  }
  throw new GoogleCalendarAuthError("oauth_not_connected", "Google OAuth connection is required");
}

export async function getGoogleCalendarAuthContext(args?: {
  allowServiceAccount?: boolean;
}): Promise<GoogleCalendarAuthContext> {
  const oauthConnected = await isGoogleOAuthConnectionActive();
  if (oauthConnected) {
    const connection = await getOAuthConnection();
    return {
      mode: "oauth_user",
      actingAs: connection?.connectedEmail ?? "unknown",
      impersonatingUser: false,
      calendarId: connection?.calendarId ?? getGoogleCalendarId() ?? null,
      oauthConnected: true,
      jwtHasSubClaim: false,
      oauthScope: CALENDAR_SCOPE,
    };
  }

  if (args?.allowServiceAccount && isGoogleServiceAccountConfigured()) {
    const diagnostics = getGoogleServiceAccountCredentialDiagnostics();
    return {
      mode: "service_account",
      actingAs: "service_account_itself",
      impersonatingUser: false,
      calendarId: diagnostics.calendarId,
      oauthConnected: false,
      jwtHasSubClaim: false,
      oauthScope: CALENDAR_SCOPE,
      jwtClaimKeys: ["iss", "scope", "aud", "iat", "exp"],
    };
  }

  return {
    mode: "oauth_user",
    actingAs: "oauth_not_connected",
    impersonatingUser: false,
    calendarId: getGoogleCalendarId() ?? null,
    oauthConnected: false,
    jwtHasSubClaim: false,
    oauthScope: CALENDAR_SCOPE,
  };
}

async function getServiceAccountAccessToken(): Promise<string> {
  if (cachedServiceAccountToken && cachedServiceAccountToken.expiresAt > Date.now() + 60_000) {
    return cachedServiceAccountToken.accessToken;
  }

  const { clientEmail, privateKey } = getGoogleServiceAccountCredentials();
  if (!isGooglePrivateKeyStructurallyValid(privateKey)) {
    throw new GoogleCalendarAuthError("service_account_not_configured", "Invalid service account key");
  }

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
  const assertion = `${unsigned}.${base64url(sign.sign(privateKey))}`;

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
    throw new GoogleCalendarAuthError(
      "token_exchange",
      `Service account token exchange failed (${response.status}): ${text.slice(0, 240)}`,
    );
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedServiceAccountToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedServiceAccountToken.accessToken;
}

function oauthRefreshFailure(refresh: GoogleOAuthRefreshResult): never {
  if (refresh.reason === "not_connected") {
    throw new GoogleCalendarAuthError("oauth_not_connected");
  }
  throw new GoogleCalendarAuthError("oauth_refresh_failed", refresh.detail ?? refresh.reason);
}

/** Booking + availability provider token. Prefers OAuth; service account only when explicitly allowed. */
export async function getGoogleCalendarProviderAccessToken(args?: {
  allowServiceAccount?: boolean;
}): Promise<string> {
  const mode = await resolveGoogleCalendarAuthMode(args);
  if (mode === "oauth_user") {
    const refreshed = await getGoogleOAuthAccessToken();
    if (!refreshed.ok) {
      oauthRefreshFailure(refreshed);
    }
    return refreshed.accessToken;
  }
  return getServiceAccountAccessToken();
}

export function resetGoogleCalendarAuthCacheForTests(): void {
  cachedServiceAccountToken = null;
}

export async function isGoogleCalendarApiConfigured(): Promise<boolean> {
  if (await isGoogleOAuthConnectionActive()) {
    return Boolean(await resolveGoogleCalendarId());
  }
  return isGoogleServiceAccountConfigured();
}

export async function resolveGoogleCalendarId(): Promise<string | undefined> {
  const connection = await getOAuthConnection();
  if (connection?.calendarId) {
    return connection.calendarId;
  }
  return getGoogleCalendarId();
}
