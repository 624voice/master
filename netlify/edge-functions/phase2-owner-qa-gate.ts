/**
 * HTTP Basic Auth for the dedicated Phase 2 owner-QA Netlify site only.
 * Deploy-scoped credentials via PHASE2_OWNER_QA_EDGE_BASIC_AUTH_* (never from visitors).
 */
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow"/>';
const ROBOTS_HEADER = "noindex, nofollow, noarchive";
const MAX_ATTEMPTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;

type AttemptWindow = { count: number; resetAt: number };
const attemptByIp = new Map<string, AttemptWindow>();

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ae = enc.encode(a);
  const be = enc.encode(b);
  if (ae.length !== be.length) return false;
  let diff = 0;
  for (let i = 0; i < ae.length; i += 1) diff |= ae[i] ^ be[i];
  return diff === 0;
}

function parseBasicAuth(header: string): { user: string; pass: string } | null {
  const trimmed = header.trim();
  const match = trimmed.match(/^Basic\s+(\S+)\s*$/i);
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    const colon = decoded.indexOf(":");
    if (colon < 0) return null;
    return { user: decoded.slice(0, colon), pass: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function registerFailedAttempt(ip: string): boolean {
  const now = Date.now();
  const current = attemptByIp.get(ip);
  if (!current || now >= current.resetAt) {
    attemptByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  if (current.count > MAX_ATTEMPTS_PER_WINDOW) return true;
  return false;
}

function credentialsValid(
  parsed: { user: string; pass: string } | null,
  expectedUser: string,
  expectedPass: string,
): boolean {
  if (!parsed) return false;
  return (
    timingSafeEqual(parsed.user, expectedUser) && timingSafeEqual(parsed.pass, expectedPass)
  );
}

export default async function phase2OwnerQaGate(
  request: Request,
  context: { next: () => Promise<Response> | Response },
) {
  const user = Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER");
  const pass = Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS");
  if (!user || !pass) {
    return context.next();
  }

  const ip = clientIp(request);
  const parsed = parseBasicAuth(request.headers.get("authorization") ?? "");
  if (!credentialsValid(parsed, user, pass)) {
    const blocked = registerFailedAttempt(ip);
    if (blocked) {
      return new Response("Too many authentication attempts. Try again later.", {
        status: 429,
        headers: { "X-Robots-Tag": ROBOTS_HEADER, "Retry-After": "60" },
      });
    }
    return new Response("Owner QA preview — authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="624voice Phase 2 Owner QA", charset="UTF-8"',
        "X-Robots-Tag": ROBOTS_HEADER,
      },
    });
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", ROBOTS_HEADER);
    return new Response(response.body, { status: response.status, headers });
  }

  const html = await response.text();
  const withMeta = html.includes('name="robots"')
    ? html
    : html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${ROBOTS_META}`);
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", ROBOTS_HEADER);
  headers.delete("content-length");
  return new Response(withMeta, { status: response.status, headers });
}

export const config = {
  path: "/*",
};
