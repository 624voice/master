import { getRedis } from "~/server/speed2Lead/redis";
import { getGoogleOAuthConnectionId } from "~/server/appointmentLifecycle/googleOAuthConfig";

export type GoogleOAuthConnectionRecord = {
  connectionId: string;
  connectedEmail: string;
  calendarId: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type SanitizedGoogleOAuthConnection = {
  connectionId: string;
  connected: boolean;
  connectedEmail: string | null;
  calendarId: string | null;
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string | null;
  hasRefreshToken: boolean;
};

function connectionKey(connectionId: string): string {
  return `google:oauth:connection:${connectionId}`;
}

function oauthStateKey(state: string): string {
  return `google:oauth:state:${state}`;
}

export function sanitizeOAuthConnection(
  record: GoogleOAuthConnectionRecord | null,
): SanitizedGoogleOAuthConnection {
  if (!record) {
    return {
      connectionId: getGoogleOAuthConnectionId(),
      connected: false,
      connectedEmail: null,
      calendarId: null,
      scopes: [],
      connectedAt: null,
      updatedAt: null,
      hasRefreshToken: false,
    };
  }

  return {
    connectionId: record.connectionId,
    connected: Boolean(record.refreshToken),
    connectedEmail: record.connectedEmail,
    calendarId: record.calendarId,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    updatedAt: record.updatedAt,
    hasRefreshToken: Boolean(record.refreshToken),
  };
}

export async function saveOAuthConnection(
  record: GoogleOAuthConnectionRecord,
): Promise<void> {
  const redis = getRedis();
  await redis.set(connectionKey(record.connectionId), record);
}

export async function getOAuthConnection(
  connectionId = getGoogleOAuthConnectionId(),
): Promise<GoogleOAuthConnectionRecord | null> {
  const redis = getRedis();
  return redis.get<GoogleOAuthConnectionRecord>(connectionKey(connectionId));
}

export async function deleteOAuthConnection(
  connectionId = getGoogleOAuthConnectionId(),
): Promise<void> {
  const redis = getRedis();
  await redis.del(connectionKey(connectionId));
}

export async function saveOAuthState(args: {
  state: string;
  connectionId: string;
  redirectUri: string;
  setupSession: string;
  ttlSeconds: number;
}): Promise<void> {
  const redis = getRedis();
  await redis.set(
    oauthStateKey(args.state),
    {
      connectionId: args.connectionId,
      redirectUri: args.redirectUri,
      setupSession: args.setupSession,
      createdAt: new Date().toISOString(),
    },
    { ex: args.ttlSeconds },
  );
}

export async function consumeOAuthState(
  state: string,
): Promise<{ connectionId: string; redirectUri: string; setupSession: string } | null> {
  const redis = getRedis();
  const key = oauthStateKey(state);
  const value = await redis.get<{
    connectionId: string;
    redirectUri?: string;
    setupSession?: string;
  }>(key);
  if (!value) {
    return null;
  }
  await redis.del(key);
  if (!value.redirectUri || !value.setupSession) {
    return null;
  }
  return {
    connectionId: value.connectionId,
    redirectUri: value.redirectUri,
    setupSession: value.setupSession,
  };
}
