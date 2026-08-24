import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  buildGoogleOAuthAuthorizationUrl,
  completeGoogleOAuthCallback,
  refreshGoogleOAuthAccessToken,
  startGoogleOAuthConnection,
} from "~/server/appointmentLifecycle/googleOAuthFlow";
import {
  GOOGLE_OAUTH_SCOPES,
  getGoogleOAuthRedirectUri,
} from "~/server/appointmentLifecycle/googleOAuthConfig";
import {
  getGoogleCalendarAuthContext,
  getGoogleCalendarProviderAccessToken,
  GoogleCalendarAuthError,
  isGoogleCalendarBookingConfigured,
  resetGoogleCalendarAuthCacheForTests,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import {
  getOAuthConnection,
  sanitizeOAuthConnection,
} from "~/server/appointmentLifecycle/googleOAuthStore";
import {
  handleCalendarOAuthSmokeRequest,
  handleGoogleOAuthStartRequest,
  handleGoogleOAuthStatusRequest,
} from "~/server/appointmentLifecycle/googleOAuthHandlers";
import {
  capturedRedisStore,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";
import { seedTestGoogleOAuthConnection } from "~/server/appointmentLifecycle/testSupport/googleOAuthTestHelpers";
import { getGoogleCalendarProviderAccessToken as calendarExportToken } from "~/server/appointmentLifecycle/googleCalendar";

installSpeed2LeadIntegrationMocks();

const originalFetch = globalThis.fetch;

describe("Google OAuth authorization URL", () => {
  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.URL = "https://deploy-preview-61--624voice.netlify.app";
  });

  afterEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.URL;
  });

  test("uses required minimum scopes with offline access", () => {
    const url = new URL(buildGoogleOAuthAuthorizationUrl({ state: "test-state" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_OAUTH_SCOPES.join(" "));
    expect(url.searchParams.get("redirect_uri")).toBe(getGoogleOAuthRedirectUri());
  });
});

describe("Google OAuth callback and token storage", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_OAUTH_EXPECTED_EMAIL = "info@624voice.com";
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
    process.env.URL = "https://deploy-preview-61--624voice.netlify.app";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_EXPECTED_EMAIL;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.URL;
  });

  test("validates OAuth state and stores refresh token securely", async () => {
    const started = await startGoogleOAuthConnection();
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 3600,
            scope: GOOGLE_OAUTH_SCOPES.join(" "),
          }),
          { status: 200 },
        );
      }
      if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
        return new Response(JSON.stringify({ email: "info@624voice.com" }), { status: 200 });
      }
      return originalFetch(input);
    }) as typeof fetch;

    const result = await completeGoogleOAuthCallback({
      code: "auth-code",
      state: started.state,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await getOAuthConnection();
    expect(stored?.refreshToken).toBe("oauth-refresh-token");
    expect(stored?.connectedEmail).toBe("info@624voice.com");
    expect(JSON.stringify(sanitizeOAuthConnection(stored))).not.toContain("oauth-refresh-token");
    expect(sanitizeOAuthConnection(stored).hasRefreshToken).toBe(true);
  });

  test("rejects invalid OAuth state", async () => {
    const result = await completeGoogleOAuthCallback({ code: "auth-code", state: "bad-state" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_state");
  });

  test("refresh obtains usable access token without exposing secrets", async () => {
    await seedTestGoogleOAuthConnection({
      refreshToken: "oauth-refresh-token",
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token") && init?.method === "POST") {
        const body = String(init.body);
        expect(body).toContain("grant_type=refresh_token");
        expect(body).toContain("oauth-refresh-token");
        return new Response(
          JSON.stringify({ access_token: "refreshed-access-token", expires_in: 3600 }),
          { status: 200 },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const refreshed = await refreshGoogleOAuthAccessToken();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.accessToken).toBe("refreshed-access-token");

    const token = await getGoogleCalendarProviderAccessToken();
    expect(token).toBe("refreshed-access-token");
  });

  test("token refresh failure returns typed auth error", async () => {
    await seedTestGoogleOAuthConnection({
      refreshToken: "oauth-refresh-token",
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response("invalid_grant", { status: 400 });
      }
      return originalFetch(input);
    }) as typeof fetch;

    await expect(getGoogleCalendarProviderAccessToken()).rejects.toBeInstanceOf(
      GoogleCalendarAuthError,
    );
  });
});

describe("OAuth provider selection", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    resetGoogleCalendarAuthCacheForTests();
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "unused";
  });

  afterEach(() => {
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  test("uses OAuth token after OAuth provider selected", async () => {
    await seedTestGoogleOAuthConnection();
    const auth = await getGoogleCalendarAuthContext();
    expect(auth.mode).toBe("oauth_user");
    expect(auth.oauthConnected).toBe(true);
    expect(await isGoogleCalendarBookingConfigured()).toBe(true);

    const token = await calendarExportToken();
    expect(token).toBe("test-oauth-access-token");
  });

  test("does not use service account when OAuth connection is active", async () => {
    await seedTestGoogleOAuthConnection();
    let saTokenRequested = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token") && init?.body?.toString().includes("jwt-bearer")) {
        saTokenRequested = true;
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    await getGoogleCalendarProviderAccessToken();
    expect(saTokenRequested).toBe(false);
  });
});

describe("OAuth setup and smoke handlers", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalContext = process.env.CONTEXT;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.CONTEXT = "deploy-preview";
    process.env.NODE_ENV = "production";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.CONTEXT = originalContext;
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_ID;
  });

  test("status handler requires auth and never returns tokens", async () => {
    const unauthorized = await handleGoogleOAuthStatusRequest(
      new Request("https://deploy-preview-61--624voice.netlify.app/api/google/oauth/status"),
    );
    expect(unauthorized.status).toBe(401);

    const response = await handleGoogleOAuthStatusRequest(
      new Request("https://deploy-preview-61--624voice.netlify.app/api/google/oauth/status?token=test-cron-secret", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("refreshToken");
    expect(JSON.stringify(body)).not.toContain("access_token");
  });

  test("start handler redirects to Google OAuth", async () => {
    const response = await handleGoogleOAuthStartRequest(
      new Request("https://deploy-preview-61--624voice.netlify.app/api/google/oauth/start?token=test-cron-secret"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("accounts.google.com/o/oauth2/v2/auth");
  });

  test("oauth smoke handler reports not connected before authorization", async () => {
    const response = await handleCalendarOAuthSmokeRequest(
      new Request("https://deploy-preview-61--624voice.netlify.app/api/cron/calendar-oauth-smoke?booking=false", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { configurationError?: string };
    expect(body.configurationError).toBe("oauth_not_connected");
  });
});
