/**
 * HTTP Basic Auth for the dedicated Phase 2 owner-QA Netlify site only.
 * Deploy-scoped credentials via PHASE2_OWNER_QA_EDGE_BASIC_AUTH_* (never from visitors).
 */
import { getStore } from "@netlify/blobs";

const ROBOTS_META = '<meta name="robots" content="noindex, nofollow"/>';
const ROBOTS_HEADER = "noindex, nofollow, noarchive";
const MAX_ATTEMPTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;
const RATE_LIMIT_STORE = "phase2-owner-qa-edge-ratelimit";

type AttemptWindow = { count: number; resetAt: number };
const attemptByIpFallback = new Map<string, AttemptWindow>();

type EdgeContext = {
  next: () => Promise<Response> | Response;
  ip?: string;
};

function denyHeaders(includeWwwAuthenticate: boolean): HeadersInit {
  const headers: Record<string, string> = { "X-Robots-Tag": ROBOTS_HEADER };
  if (includeWwwAuthenticate) {
    headers["WWW-Authenticate"] = 'Basic realm="624voice Phase 2 Owner QA", charset="UTF-8"';
  }
  return headers;
}

/** Fail closed when edge credentials are missing or mis-scoped (never serve origin unauthenticated). */
function misconfiguredResponse(): Response {
  return new Response("Owner QA preview authentication is not configured.", {
    status: 503,
    headers: denyHeaders(false),
  });
}

/** Dedicated owner-QA site or PR deploy-preview surfaces (never production). */
function isOwnerQaPreviewSurface(): boolean {
  if (Netlify.env.get("PHASE2_OWNER_QA_PREVIEW") === "1") return true;
  if (Netlify.env.get("PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW") === "1") return true;
  return false;
}

/** HTTP Basic Auth when preview surface is active; opt out via explicit owner-authorized env flag. */
function isBasicAuthEnforced(): boolean {
  if (Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED") === "1") return false;
  return isOwnerQaPreviewSurface();
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

/** Fixed-length digest compare (no early return on string byte-length mismatch). */
async function digestEqual(a: string, b: string): Promise<boolean> {
  const [ae, be] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
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

/**
 * Platform client address from Netlify Context.ip (see Edge Functions API — not visitor-controlled).
 * Header x-nf-client-connection-ip is not used for rate-limit keys.
 */
function clientIp(context: EdgeContext): string {
  return context.ip?.trim() || "unknown";
}

function registerFailedAttemptLocal(ip: string): boolean {
  const now = Date.now();
  const current = attemptByIpFallback.get(ip);
  if (!current || now >= current.resetAt) {
    attemptByIpFallback.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  if (current.count > MAX_ATTEMPTS_PER_WINDOW) return true;
  return false;
}

async function registerFailedAttempt(ip: string): Promise<{ blocked: boolean; mode: "blob" | "isolate-fallback" }> {
  const now = Date.now();
  try {
    const store = getStore(RATE_LIMIT_STORE);
    const key = `auth-fail:${ip}`;
    const current = (await store.get(key, { type: "json" })) as AttemptWindow | null;
    if (!current || now >= current.resetAt) {
      await store.setJSON(key, { count: 1, resetAt: now + WINDOW_MS });
      return { blocked: false, mode: "blob" };
    }
    const next = { count: current.count + 1, resetAt: current.resetAt };
    await store.setJSON(key, next);
    return { blocked: next.count > MAX_ATTEMPTS_PER_WINDOW, mode: "blob" };
  } catch {
    return { blocked: registerFailedAttemptLocal(ip), mode: "isolate-fallback" };
  }
}

async function credentialsValid(
  parsed: { user: string; pass: string } | null,
  expectedUser: string,
  expectedPass: string,
): Promise<boolean> {
  if (!parsed) return false;
  const [userOk, passOk] = await Promise.all([
    digestEqual(parsed.user, expectedUser),
    digestEqual(parsed.pass, expectedPass),
  ]);
  return userOk && passOk;
}

async function applyNoindexToResponse(response: Response): Promise<Response> {
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

export default async function phase2OwnerQaGate(request: Request, context: EdgeContext) {
  if (!isOwnerQaPreviewSurface()) {
    return context.next();
  }

  if (!isBasicAuthEnforced()) {
    const response = await context.next();
    return await applyNoindexToResponse(response);
  }

  const user = (Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER") ?? "").trim();
  const pass = (Netlify.env.get("PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS") ?? "").trim();

  if ((user && !pass) || (!user && pass) || (!user && !pass)) {
    return misconfiguredResponse();
  }

  const ip = clientIp(context);
  const parsed = parseBasicAuth(request.headers.get("authorization") ?? "");
  if (!(await credentialsValid(parsed, user, pass))) {
    const { blocked } = await registerFailedAttempt(ip);
    if (blocked) {
      return new Response("Too many authentication attempts. Try again later.", {
        status: 429,
        headers: { ...denyHeaders(false), "Retry-After": "60" },
      });
    }
    return new Response("Owner QA preview — authentication required.", {
      status: 401,
      headers: denyHeaders(true),
    });
  }

  const response = await context.next();
  return await applyNoindexToResponse(response);
}

export const config = {
  path: "/*",
};
