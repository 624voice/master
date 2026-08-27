import { getGoogleCalendarId } from "~/server/appointmentLifecycle/config";
import { getSiteOrigin } from "~/server/speed2Lead/config";

/** Minimum Calendar scope for availability, event CRUD, and Meet conference creation. */
export const GOOGLE_OAUTH_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export const GOOGLE_OAUTH_USERINFO_SCOPE = "openid email profile";

export const GOOGLE_OAUTH_SCOPES = [
  GOOGLE_OAUTH_CALENDAR_SCOPE,
  GOOGLE_OAUTH_USERINFO_SCOPE,
] as const;

const OAUTH_STATE_TTL_SECONDS = 60 * 10;

export function getGoogleOAuthConnectionId(): string {
  return process.env.GOOGLE_OAUTH_CONNECTION_ID?.trim() || "primary";
}

export function getGoogleOAuthClientId(): string | undefined {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || undefined;
}

export function getGoogleOAuthClientSecret(): string | undefined {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || undefined;
}

export function isGoogleOAuthClientConfigured(): boolean {
  return Boolean(getGoogleOAuthClientId() && getGoogleOAuthClientSecret());
}

export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/google/oauth/callback";

export function buildGoogleOAuthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

function resolveProductionOAuthOrigin(): string {
  return (
    process.env.GOOGLE_OAUTH_BASE_URL?.trim() ||
    process.env.URL?.trim() ||
    getSiteOrigin()
  );
}

/** Resolve OAuth callback URI for the active deployment context. */
export function resolveGoogleOAuthRedirectUri(args?: { request?: Request }): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  // Request origin is authoritative for preview OAuth start/callback handlers.
  if (args?.request) {
    return buildGoogleOAuthRedirectUri(new URL(args.request.url).origin);
  }

  const context = process.env.CONTEXT?.trim();
  if (context && context !== "production") {
    const deployUrl = process.env.DEPLOY_PRIME_URL?.trim() || process.env.DEPLOY_URL?.trim();
    if (deployUrl) {
      return buildGoogleOAuthRedirectUri(deployUrl);
    }
  }

  return buildGoogleOAuthRedirectUri(resolveProductionOAuthOrigin());
}

export function getGoogleOAuthRedirectUri(request?: Request): string {
  return resolveGoogleOAuthRedirectUri({ request });
}

/** Optional expected connected account for this deployment (e.g. info@624voice.com). */
export function getGoogleOAuthExpectedEmail(): string | undefined {
  return process.env.GOOGLE_OAUTH_EXPECTED_EMAIL?.trim() || undefined;
}

export function getGoogleOAuthStateTtlSeconds(): number {
  return OAUTH_STATE_TTL_SECONDS;
}

export function resolveGoogleOAuthCalendarId(connectionCalendarId?: string): string | undefined {
  return connectionCalendarId?.trim() || getGoogleCalendarId();
}

export type GoogleOAuthConfigurationDiagnostics = {
  clientConfigured: boolean;
  redirectUri: string;
  connectionId: string;
  expectedEmail: string | null;
  calendarId: string | null;
};

export function getGoogleOAuthConfigurationDiagnostics(args?: {
  request?: Request;
}): GoogleOAuthConfigurationDiagnostics {
  return {
    clientConfigured: isGoogleOAuthClientConfigured(),
    redirectUri: resolveGoogleOAuthRedirectUri(args),
    connectionId: getGoogleOAuthConnectionId(),
    expectedEmail: getGoogleOAuthExpectedEmail() ?? null,
    calendarId: getGoogleCalendarId() ?? null,
  };
}
