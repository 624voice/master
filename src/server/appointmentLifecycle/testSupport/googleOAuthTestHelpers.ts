import type { GoogleOAuthConnectionRecord } from "~/server/appointmentLifecycle/googleOAuthStore";
import { saveOAuthConnection } from "~/server/appointmentLifecycle/googleOAuthStore";
import { GOOGLE_OAUTH_SCOPES } from "~/server/appointmentLifecycle/googleOAuthConfig";

export async function seedTestGoogleOAuthConnection(
  overrides: Partial<GoogleOAuthConnectionRecord> = {},
): Promise<GoogleOAuthConnectionRecord> {
  const now = new Date();
  const record: GoogleOAuthConnectionRecord = {
    connectionId: "primary",
    connectedEmail: "info@624voice.com",
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "test-calendar",
    refreshToken: "test-refresh-token",
    accessToken: "test-oauth-access-token",
    accessTokenExpiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    scopes: [...GOOGLE_OAUTH_SCOPES],
    connectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
  await saveOAuthConnection(record);
  return record;
}
