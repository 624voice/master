import { getGoogleOAuthConfigurationDiagnostics, getGoogleOAuthExpectedEmail } from "~/server/appointmentLifecycle/googleOAuthConfig";
import {
  getGoogleCalendarAuthContext,
  getSanitizedOAuthConnectionStatus,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import {
  buildGoogleCalendarConnectUrl,
  buildGoogleCalendarSetupPageUrl,
} from "~/server/appointmentLifecycle/googleCalendarSetupSearch";
import {
  extractSetupSessionFromRequest,
  isGoogleCalendarSetupAuthorized,
} from "~/server/appointmentLifecycle/googleCalendarSetupAuth";
import { isPreviewDiagnosticContext } from "~/server/appointmentLifecycle/previewDiagnostics";

export type GoogleOAuthStatusResponse = {
  ok: boolean;
  previewOnly: true;
  oauthClientConfigured: boolean;
  redirectUri: string;
  expectedEmail: string | null;
  expectedEmailMatch: boolean | null;
  connection: Awaited<ReturnType<typeof getSanitizedOAuthConnectionStatus>>;
  auth: Awaited<ReturnType<typeof getGoogleCalendarAuthContext>>;
  setupPath: string;
  connectPath: string;
};

export async function getGoogleOAuthStatusResponse(args: {
  origin: string;
  setupToken?: string;
  setupSession?: string;
  request?: Request;
}): Promise<GoogleOAuthStatusResponse> {
  const diagnostics = getGoogleOAuthConfigurationDiagnostics({ request: args.request });
  const authRef = {
    token: args.setupToken,
    setupSession: args.setupSession,
  };
  const connection = await getSanitizedOAuthConnectionStatus();
  const auth = await getGoogleCalendarAuthContext();
  const expectedEmail = getGoogleOAuthExpectedEmail() ?? null;

  return {
    ok: diagnostics.clientConfigured,
    previewOnly: true,
    oauthClientConfigured: diagnostics.clientConfigured,
    redirectUri: diagnostics.redirectUri,
    expectedEmail,
    expectedEmailMatch: expectedEmail
      ? connection.connectedEmail?.toLowerCase() === expectedEmail.toLowerCase()
      : null,
    connection,
    auth,
    setupPath: buildGoogleCalendarSetupPageUrl({ origin: args.origin, auth: authRef }),
    connectPath: buildGoogleCalendarConnectUrl(authRef),
  };
}

export async function handleGoogleOAuthStatusRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!(await isGoogleCalendarSetupAuthorized(request))) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const setupToken = url.searchParams.get("token") ?? undefined;
  const setupSession = extractSetupSessionFromRequest(request) ?? undefined;
  const payload = await getGoogleOAuthStatusResponse({
    origin: url.origin,
    setupToken: setupToken ?? undefined,
    setupSession,
    request,
  });

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleGoogleOAuthStartRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!(await isGoogleCalendarSetupAuthorized(request))) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { startGoogleOAuthConnection } = await import("~/server/appointmentLifecycle/googleOAuthFlow");
  const started = await startGoogleOAuthConnection({ request });
  if (!started.ok) {
    return new Response(JSON.stringify({ ok: false, error: started.reason }), {
      status: started.reason === "not_configured" ? 503 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.redirect(started.authorizationUrl, 302);
}

export async function handleGoogleOAuthCallbackRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response("Not available in production", { status: 404 });
  }

  const url = new URL(request.url);
  const { completeGoogleOAuthCallback } = await import("~/server/appointmentLifecycle/googleOAuthFlow");
  const result = await completeGoogleOAuthCallback({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    request,
  });

  const authRef = result.setupSession ? { setupSession: result.setupSession } : undefined;
  if (!result.ok) {
    const redirect = buildGoogleCalendarSetupPageUrl({
      origin: url.origin,
      auth: authRef,
      error: result.reason,
    });
    return Response.redirect(redirect, 302);
  }

  const redirect = buildGoogleCalendarSetupPageUrl({
    origin: url.origin,
    auth: { setupSession: result.setupSession },
    connected: true,
  });
  return Response.redirect(redirect, 302);
}

export async function handleCalendarOAuthSmokeRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { isCalendarBookingSmokeAuthorized } = await import(
    "~/server/appointmentLifecycle/calendarBookingSmoke"
  );
  if (!isCalendarBookingSmokeAuthorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start")?.trim() || "2026-08-26T14:00:00.000Z";
  const includeBooking = url.searchParams.get("booking") !== "false";
  const cleanup = url.searchParams.get("cleanup") !== "false";

  const { probeOAuthCalendarSmoke } = await import("~/server/appointmentLifecycle/calendarOAuthSmoke");
  const result = await probeOAuthCalendarSmoke({ start, includeBooking, cleanup });

  return new Response(JSON.stringify(result), {
    status: result.configurationError ? 503 : result.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}
