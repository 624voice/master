export type GoogleCalendarSetupSearch = {
  token: string;
  setupSession: string;
  connected: boolean;
  error: string;
};

export type GoogleCalendarSetupAuthRef = {
  token?: string;
  setupSession?: string;
};

function readSetupSearchString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return readSetupSearchString(value[0]);
  }
  return "";
}

function readSetupSearchFlag(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function parseSearchString(searchStr: string | undefined): GoogleCalendarSetupSearch {
  if (!searchStr?.trim()) {
    return { token: "", setupSession: "", connected: false, error: "" };
  }

  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const params = new URLSearchParams(normalized);

  return {
    token: params.get("token")?.trim() ?? "",
    setupSession: params.get("setup")?.trim() ?? "",
    connected: params.get("connected") === "1",
    error: params.get("error")?.trim() ?? "",
  };
}

/** Parse setup-page search params from router search and/or raw searchStr. */
export function parseGoogleCalendarSetupSearch(
  search: Record<string, unknown>,
  searchStr?: string,
): GoogleCalendarSetupSearch {
  const fromSearchStr = parseSearchString(searchStr);
  if (
    fromSearchStr.token ||
    fromSearchStr.setupSession ||
    fromSearchStr.connected ||
    fromSearchStr.error
  ) {
    return fromSearchStr;
  }

  return {
    token: readSetupSearchString(search.token),
    setupSession: readSetupSearchString(search.setup ?? search.setupSession),
    connected: readSetupSearchFlag(search.connected),
    error: readSetupSearchString(search.error),
  };
}

export function hasGoogleCalendarSetupAuth(search: GoogleCalendarSetupSearch): boolean {
  return search.token.length > 0 || search.setupSession.length > 0;
}

export function buildGoogleCalendarSetupStatusUrl(auth: GoogleCalendarSetupAuthRef): string {
  const params = new URLSearchParams();
  if (auth.token) {
    params.set("token", auth.token);
  }
  if (auth.setupSession) {
    params.set("setup", auth.setupSession);
  }
  return `/api/google/oauth/status?${params.toString()}`;
}

export function buildGoogleCalendarConnectUrl(auth: GoogleCalendarSetupAuthRef): string {
  const params = new URLSearchParams();
  if (auth.token) {
    params.set("token", auth.token);
  }
  if (auth.setupSession) {
    params.set("setup", auth.setupSession);
  }
  return `/api/google/oauth/start?${params.toString()}`;
}

export function buildGoogleCalendarSetupPageUrl(args: {
  origin: string;
  auth?: GoogleCalendarSetupAuthRef;
  connected?: boolean;
  error?: string;
}): string {
  const params = new URLSearchParams();
  if (args.auth?.token) {
    params.set("token", args.auth.token);
  }
  if (args.auth?.setupSession) {
    params.set("setup", args.auth.setupSession);
  }
  if (args.connected) {
    params.set("connected", "1");
  }
  if (args.error) {
    params.set("error", args.error);
  }
  const query = params.toString();
  return `${args.origin.replace(/\/$/, "")}/setup/google-calendar${query ? `?${query}` : ""}`;
}
