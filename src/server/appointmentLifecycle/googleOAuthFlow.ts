import { createHash, randomBytes } from "node:crypto";
import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthConnectionId,
  getGoogleOAuthExpectedEmail,
  getGoogleOAuthStateTtlSeconds,
  GOOGLE_OAUTH_SCOPES,
  isGoogleOAuthClientConfigured,
  resolveGoogleOAuthCalendarId,
  resolveGoogleOAuthRedirectUri,
} from "~/server/appointmentLifecycle/googleOAuthConfig";
import {
  consumeOAuthState,
  getOAuthConnection,
  saveOAuthConnection,
  saveOAuthState,
  type GoogleOAuthConnectionRecord,
} from "~/server/appointmentLifecycle/googleOAuthStore";
import { extractSetupSessionFromRequest } from "~/server/appointmentLifecycle/googleCalendarSetupAuth";
import {
  resolveGoogleOAuthSetupSession,
  touchGoogleOAuthSetupSession,
} from "~/server/appointmentLifecycle/googleOAuthSetupSession";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export type GoogleOAuthStartResult =
  | { ok: true; authorizationUrl: string; state: string }
  | { ok: false; reason: "not_configured" | "redis_unavailable" };

export type GoogleOAuthCallbackResult =
  | { ok: true; connection: GoogleOAuthConnectionRecord; setupSession: string }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "invalid_state"
        | "token_exchange_failed"
        | "missing_refresh_token"
        | "userinfo_failed"
        | "email_mismatch";
      detail?: string;
      setupSession?: string;
    };

export type GoogleOAuthRefreshResult =
  | { ok: true; accessToken: string; expiresAt: string }
  | {
      ok: false;
      reason: "not_connected" | "refresh_failed" | "missing_refresh_token";
      detail?: string;
    };

function hashForLog(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function buildGoogleOAuthAuthorizationUrl(args: {
  state: string;
  redirectUri: string;
}): string {
  const clientId = getGoogleOAuthClientId();
  if (!clientId) {
    throw new Error("Google OAuth client is not configured");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", args.state);
  return url.toString();
}

export async function startGoogleOAuthConnection(args?: {
  request?: Request;
}): Promise<GoogleOAuthStartResult> {
  if (!isGoogleOAuthClientConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const state = randomBytes(24).toString("hex");
  const connectionId = getGoogleOAuthConnectionId();
  const redirectUri = resolveGoogleOAuthRedirectUri({ request: args?.request });
  const existingSetupSession = args?.request
    ? extractSetupSessionFromRequest(args.request)
    : null;
  const setupSession = await resolveGoogleOAuthSetupSession({
    existingSession: existingSetupSession,
  });

  try {
    await saveOAuthState({
      state,
      connectionId,
      redirectUri,
      setupSession,
      ttlSeconds: getGoogleOAuthStateTtlSeconds(),
    });
  } catch {
    return { ok: false, reason: "redis_unavailable" };
  }

  return {
    ok: true,
    state,
    authorizationUrl: buildGoogleOAuthAuthorizationUrl({ state, redirectUri }),
  };
}

async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<
  | {
      ok: true;
      refreshToken: string;
      accessToken: string;
      expiresIn: number;
      scopes: string[];
    }
  | { ok: false; detail: string }
> {
  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, detail: "OAuth client not configured" };
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, detail: `Token exchange failed (${response.status}): ${text.slice(0, 240)}` };
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!data.access_token) {
    return { ok: false, detail: "Token exchange response missing access_token" };
  }
  if (!data.refresh_token) {
    return { ok: false, detail: "Token exchange response missing refresh_token" };
  }

  return {
    ok: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    scopes: data.scope?.split(" ").filter(Boolean) ?? [...GOOGLE_OAUTH_SCOPES],
  };
}

async function fetchGoogleUserEmail(accessToken: string): Promise<
  | { ok: true; email: string }
  | { ok: false; detail: string }
> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      detail: `Userinfo failed (${response.status}): ${text.slice(0, 240)}`,
    };
  }

  const data = (await response.json()) as { email?: string };
  if (!data.email?.trim()) {
    return { ok: false, detail: "Userinfo response missing email" };
  }

  return { ok: true, email: data.email.trim().toLowerCase() };
}

export async function completeGoogleOAuthCallback(args: {
  code?: string | null;
  state?: string | null;
  request?: Request;
}): Promise<GoogleOAuthCallbackResult> {
  if (!isGoogleOAuthClientConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  if (!args.code?.trim() || !args.state?.trim()) {
    return { ok: false, reason: "invalid_state", detail: "Missing code or state" };
  }

  const stateRecord = await consumeOAuthState(args.state.trim());
  if (!stateRecord) {
    return { ok: false, reason: "invalid_state" };
  }

  const setupSession = stateRecord.setupSession;

  const exchanged = await exchangeAuthorizationCode(args.code.trim(), stateRecord.redirectUri);
  if (!exchanged.ok) {
    return {
      ok: false,
      reason: exchanged.detail.includes("refresh_token")
        ? "missing_refresh_token"
        : "token_exchange_failed",
      detail: exchanged.detail,
      setupSession,
    };
  }

  const userinfo = await fetchGoogleUserEmail(exchanged.accessToken);
  if (!userinfo.ok) {
    return { ok: false, reason: "userinfo_failed", detail: userinfo.detail, setupSession };
  }

  const expectedEmail = getGoogleOAuthExpectedEmail()?.toLowerCase();
  if (expectedEmail && userinfo.email !== expectedEmail) {
    return {
      ok: false,
      reason: "email_mismatch",
      detail: `Connected account must be ${expectedEmail}`,
      setupSession,
    };
  }

  const calendarId = resolveGoogleOAuthCalendarId();
  if (!calendarId) {
    return {
      ok: false,
      reason: "not_configured",
      detail: "GOOGLE_CALENDAR_ID is not configured",
      setupSession,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + exchanged.expiresIn * 1000).toISOString();
  const connection: GoogleOAuthConnectionRecord = {
    connectionId: stateRecord.connectionId,
    connectedEmail: userinfo.email,
    calendarId,
    refreshToken: exchanged.refreshToken,
    accessToken: exchanged.accessToken,
    accessTokenExpiresAt: expiresAt,
    scopes: exchanged.scopes,
    connectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await saveOAuthConnection(connection);
  await touchGoogleOAuthSetupSession(setupSession);

  console.log(
    JSON.stringify({
      component: "googleOAuth",
      event: "connection_saved",
      at: now.toISOString(),
      connectionId: connection.connectionId,
      connectedEmail: connection.connectedEmail,
      calendarId: connection.calendarId,
      refreshTokenHash: hashForLog(connection.refreshToken),
      scopes: connection.scopes,
    }),
  );

  return { ok: true, connection, setupSession };
}

export async function refreshGoogleOAuthAccessToken(
  connectionId = getGoogleOAuthConnectionId(),
): Promise<GoogleOAuthRefreshResult> {
  const connection = await getOAuthConnection(connectionId);
  if (!connection?.refreshToken) {
    return { ok: false, reason: "not_connected" };
  }

  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, reason: "refresh_failed", detail: "OAuth client not configured" };
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      reason: "refresh_failed",
      detail: `Refresh failed (${response.status}): ${text.slice(0, 240)}`,
    };
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!data.access_token) {
    return { ok: false, reason: "refresh_failed", detail: "Refresh response missing access_token" };
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  const updated: GoogleOAuthConnectionRecord = {
    ...connection,
    accessToken: data.access_token,
    accessTokenExpiresAt: expiresAt,
    scopes: data.scope?.split(" ").filter(Boolean) ?? connection.scopes,
    updatedAt: new Date().toISOString(),
  };
  await saveOAuthConnection(updated);

  return { ok: true, accessToken: data.access_token, expiresAt };
}

export async function getGoogleOAuthAccessToken(
  connectionId = getGoogleOAuthConnectionId(),
): Promise<GoogleOAuthRefreshResult> {
  const connection = await getOAuthConnection(connectionId);
  if (!connection?.refreshToken) {
    return { ok: false, reason: "not_connected" };
  }

  const expiresAtMs = connection.accessTokenExpiresAt
    ? new Date(connection.accessTokenExpiresAt).getTime()
    : 0;
  if (connection.accessToken && expiresAtMs > Date.now() + 60_000) {
    return {
      ok: true,
      accessToken: connection.accessToken,
      expiresAt: connection.accessTokenExpiresAt!,
    };
  }

  return refreshGoogleOAuthAccessToken(connectionId);
}
