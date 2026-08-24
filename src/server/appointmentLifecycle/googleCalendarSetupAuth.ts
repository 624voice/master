import { isGoogleOAuthSetupSessionValid } from "~/server/appointmentLifecycle/googleOAuthSetupSession";

export function extractCronSecretFromRequest(request: Request): string | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production" ? "__dev_open__" : null;
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${secret}`) {
    return secret;
  }

  if (request.headers.get("X-Cron-Secret") === secret) {
    return secret;
  }

  const queryToken = new URL(request.url).searchParams.get("token");
  return queryToken === secret ? secret : null;
}

export function extractSetupSessionFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const setupSession =
    url.searchParams.get("setup")?.trim() ||
    request.headers.get("X-Setup-Session")?.trim() ||
    null;
  return setupSession || null;
}

export function isCronSecretAuthorized(request: Request): boolean {
  return extractCronSecretFromRequest(request) !== null;
}

/** Operator auth for preview Google Calendar setup/status/OAuth start flows. */
export async function isGoogleCalendarSetupAuthorized(request: Request): Promise<boolean> {
  if (isCronSecretAuthorized(request)) {
    return true;
  }

  const setupSession = extractSetupSessionFromRequest(request);
  return isGoogleOAuthSetupSessionValid(setupSession ?? undefined);
}
