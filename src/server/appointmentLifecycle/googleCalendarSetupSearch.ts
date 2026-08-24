export type GoogleCalendarSetupSearch = {
  token: string;
  connected: boolean;
  error: string;
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
    return { token: "", connected: false, error: "" };
  }

  const normalized = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const params = new URLSearchParams(normalized);

  return {
    token: params.get("token")?.trim() ?? "",
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
  if (fromSearchStr.token || fromSearchStr.connected || fromSearchStr.error) {
    return fromSearchStr;
  }

  return {
    token: readSetupSearchString(search.token),
    connected: readSetupSearchFlag(search.connected),
    error: readSetupSearchString(search.error),
  };
}

export function hasGoogleCalendarSetupToken(search: GoogleCalendarSetupSearch): boolean {
  return search.token.length > 0;
}

export function buildGoogleCalendarSetupStatusUrl(token: string): string {
  return `/api/google/oauth/status?token=${encodeURIComponent(token)}`;
}

export function buildGoogleCalendarConnectUrl(token: string): string {
  return `/api/google/oauth/start?token=${encodeURIComponent(token)}`;
}
