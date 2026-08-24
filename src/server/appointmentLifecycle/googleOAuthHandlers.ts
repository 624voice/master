import { getGoogleOAuthConfigurationDiagnostics } from "~/server/appointmentLifecycle/googleOAuthConfig";
import {
  getGoogleCalendarAuthContext,
  getSanitizedOAuthConnectionStatus,
} from "~/server/appointmentLifecycle/googleCalendarAuth";
import {
  isCalendarBookingSmokeAuthorized,
  isPreviewDiagnosticContext,
} from "~/server/appointmentLifecycle/calendarBookingSmoke";

export type GoogleOAuthStatusResponse = {
  ok: boolean;
  previewOnly: true;
  oauthClientConfigured: boolean;
  redirectUri: string;
  connection: Awaited<ReturnType<typeof getSanitizedOAuthConnectionStatus>>;
  auth: Awaited<ReturnType<typeof getGoogleCalendarAuthContext>>;
  setupPath: string;
  connectPath: string;
};

export function buildGoogleOAuthSetupPaths(origin: string, setupToken?: string): {
  setupPath: string;
  connectPath: string;
} {
  const tokenQuery = setupToken ? `?token=${encodeURIComponent(setupToken)}` : "";
  const base = origin.replace(/\/$/, "");
  return {
    setupPath: `${base}/setup/google-calendar${tokenQuery}`,
    connectPath: `${base}/api/google/oauth/start${tokenQuery}`,
  };
}

export async function getGoogleOAuthStatusResponse(args: {
  origin: string;
  setupToken?: string;
  request?: Request;
}): Promise<GoogleOAuthStatusResponse> {
  const diagnostics = getGoogleOAuthConfigurationDiagnostics({ request: args.request });
  const paths = buildGoogleOAuthSetupPaths(args.origin, args.setupToken);
  const connection = await getSanitizedOAuthConnectionStatus();
  const auth = await getGoogleCalendarAuthContext();

  return {
    ok: diagnostics.clientConfigured,
    previewOnly: true,
    oauthClientConfigured: diagnostics.clientConfigured,
    redirectUri: diagnostics.redirectUri,
    connection,
    auth,
    setupPath: paths.setupPath,
    connectPath: paths.connectPath,
  };
}

export async function handleGoogleOAuthStatusRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isCalendarBookingSmokeAuthorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const setupToken = url.searchParams.get("token") ?? undefined;
  const payload = await getGoogleOAuthStatusResponse({
    origin: url.origin,
    setupToken: setupToken ?? undefined,
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

  if (!isCalendarBookingSmokeAuthorized(request)) {
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

  const setupBase = `${url.origin}/setup/google-calendar`;
  if (!result.ok) {
    const redirect = `${setupBase}?error=${encodeURIComponent(result.reason)}`;
    return Response.redirect(redirect, 302);
  }

  return Response.redirect(`${setupBase}?connected=1`, 302);
}

export async function handleCalendarOAuthSmokeRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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
