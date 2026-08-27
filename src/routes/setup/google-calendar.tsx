import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  buildGoogleCalendarConnectUrl,
  buildGoogleCalendarSetupStatusUrl,
  hasGoogleCalendarSetupAuth,
  parseGoogleCalendarSetupSearch,
  type GoogleCalendarSetupAuthRef,
} from "~/server/appointmentLifecycle/googleCalendarSetupSearch";
import { isPreviewDiagnosticContext } from "~/server/appointmentLifecycle/previewDiagnostics";

export const Route = createFileRoute("/setup/google-calendar")({
  validateSearch: (search: Record<string, unknown>) =>
    parseGoogleCalendarSetupSearch(search),
  component: GoogleCalendarSetupPage,
});

type StatusPayload = {
  ok: boolean;
  oauthClientConfigured: boolean;
  redirectUri: string;
  expectedEmail: string | null;
  expectedEmailMatch: boolean | null;
  connection: {
    connected: boolean;
    connectedEmail: string | null;
    calendarId: string | null;
    scopes: string[];
    hasRefreshToken?: boolean;
  };
  auth: {
    mode: string;
    actingAs: string;
    oauthConnected: boolean;
  };
  connectPath: string;
  error?: string;
};

function GoogleCalendarSetupPage() {
  const routerSearch = Route.useSearch();
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const search = useMemo(
    () => parseGoogleCalendarSetupSearch(routerSearch, searchStr),
    [routerSearch, searchStr],
  );
  const [resolvedAuth, setResolvedAuth] = useState<GoogleCalendarSetupAuthRef>({
    token: search.token,
    setupSession: search.setupSession,
  });

  useEffect(() => {
    const nextAuth: GoogleCalendarSetupAuthRef = {
      token: search.token || undefined,
      setupSession: search.setupSession || undefined,
    };

    if (nextAuth.token || nextAuth.setupSession) {
      setResolvedAuth(nextAuth);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token")?.trim() ?? "";
    const setupSession = params.get("setup")?.trim() ?? "";
    if (token || setupSession) {
      setResolvedAuth({
        token: token || undefined,
        setupSession: setupSession || undefined,
      });
    }
  }, [search.token, search.setupSession]);

  const statusUrl = useMemo(
    () =>
      hasGoogleCalendarSetupAuth({ ...search, ...resolvedAuth, token: resolvedAuth.token ?? "", setupSession: resolvedAuth.setupSession ?? "" })
        ? buildGoogleCalendarSetupStatusUrl(resolvedAuth)
        : "",
    [resolvedAuth, search],
  );

  if (!isPreviewDiagnosticContext()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Google Calendar setup unavailable</h1>
        <p className="mt-4 text-gray-600">This setup page is only available on deploy previews.</p>
      </main>
    );
  }

  const hasAuth = Boolean(resolvedAuth.token || resolvedAuth.setupSession);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Connect Google Calendar</h1>
      <p className="mt-4 text-gray-600">
        Authorize the 624Voice consultation calendar as your Google Workspace user so bookings can
        create Google Meet links.
      </p>

      {!hasAuth ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Open this page with your operator setup token, for example{" "}
          <code>/setup/google-calendar?token=$CRON_SECRET</code>.
        </p>
      ) : null}

      {search.connected ? (
        <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Google OAuth connection saved. Refresh status below to confirm the connected account.
        </p>
      ) : null}

      {search.error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          OAuth connection failed: {search.error}
        </p>
      ) : null}

      <SetupStatusPanel auth={resolvedAuth} statusUrl={statusUrl} />
    </main>
  );
}

function SetupStatusPanel({
  auth,
  statusUrl,
}: {
  auth: GoogleCalendarSetupAuthRef;
  statusUrl: string;
}) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    if (!statusUrl) {
      setError("Missing setup authorization.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }
      const response = await fetch(statusUrl, { headers });
      const body = (await response.json()) as StatusPayload & { error?: string };
      if (!response.ok) {
        setError(body.error ?? `Status request failed (${response.status})`);
        setStatus(null);
        return;
      }
      setStatus(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [statusUrl, auth.token, auth.setupSession]);

  const connectHref =
    auth.token || auth.setupSession ? buildGoogleCalendarConnectUrl(auth) : undefined;

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Connection status</h2>
        <button
          type="button"
          onClick={() => void loadStatus()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {status ? (
        <dl className="grid gap-3 text-sm text-gray-700">
          <div>
            <dt className="font-medium text-gray-900">OAuth client configured</dt>
            <dd>{status.oauthClientConfigured ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Connected</dt>
            <dd>{status.connection.connected ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Connected account</dt>
            <dd>{status.connection.connectedEmail ?? "Not connected"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Expected account match</dt>
            <dd>
              {status.expectedEmailMatch == null
                ? "Not configured"
                : status.expectedEmailMatch
                  ? "Yes"
                  : "No"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Refresh token stored</dt>
            <dd>{status.connection.hasRefreshToken ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">OAuth provider active</dt>
            <dd>{status.auth.oauthConnected ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Calendar ID</dt>
            <dd>{status.connection.calendarId ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Acting as</dt>
            <dd>{status.auth.actingAs}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Redirect URI</dt>
            <dd className="break-all">{status.redirectUri}</dd>
          </div>
        </dl>
      ) : null}

      {connectHref && !status?.connection.connected ? (
        <a
          href={connectHref}
          className="inline-flex rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Connect Google Calendar
        </a>
      ) : null}
    </section>
  );
}
