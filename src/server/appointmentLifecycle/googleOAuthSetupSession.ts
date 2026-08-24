import { randomBytes } from "node:crypto";
import { getRedis } from "~/server/speed2Lead/redis";

const SETUP_SESSION_KEY_PREFIX = "google:oauth:setup-session:";
export const GOOGLE_OAUTH_SETUP_SESSION_TTL_SECONDS = 60 * 30;

type SetupSessionRecord = {
  createdAt: string;
  lastUsedAt: string;
};

function setupSessionKey(sessionToken: string): string {
  return `${SETUP_SESSION_KEY_PREFIX}${sessionToken}`;
}

export function createGoogleOAuthSetupSessionToken(): string {
  return randomBytes(24).toString("hex");
}

export async function registerGoogleOAuthSetupSession(sessionToken: string): Promise<void> {
  const redis = getRedis();
  const now = new Date().toISOString();
  await redis.set(
    setupSessionKey(sessionToken),
    { createdAt: now, lastUsedAt: now } satisfies SetupSessionRecord,
    { ex: GOOGLE_OAUTH_SETUP_SESSION_TTL_SECONDS },
  );
}

export async function isGoogleOAuthSetupSessionValid(sessionToken: string | undefined): Promise<boolean> {
  if (!sessionToken?.trim()) {
    return false;
  }
  const redis = getRedis();
  const record = await redis.get<SetupSessionRecord>(setupSessionKey(sessionToken.trim()));
  return Boolean(record);
}

export async function touchGoogleOAuthSetupSession(sessionToken: string): Promise<void> {
  const redis = getRedis();
  const key = setupSessionKey(sessionToken);
  const record = await redis.get<SetupSessionRecord>(key);
  if (!record) {
    return;
  }
  await redis.set(
    key,
    { ...record, lastUsedAt: new Date().toISOString() },
    { ex: GOOGLE_OAUTH_SETUP_SESSION_TTL_SECONDS },
  );
}

export async function resolveGoogleOAuthSetupSession(args?: {
  existingSession?: string | null;
}): Promise<string> {
  const existing = args?.existingSession?.trim();
  if (existing && (await isGoogleOAuthSetupSessionValid(existing))) {
    await touchGoogleOAuthSetupSession(existing);
    return existing;
  }

  const sessionToken = createGoogleOAuthSetupSessionToken();
  await registerGoogleOAuthSetupSession(sessionToken);
  return sessionToken;
}
