/**
 * In-process preparation self-test egress guard (exact allowlisted hosts only).
 * Applies only to Bun processes that import this module (prep driver + egress probe).
 */
import http from "node:http";
import https from "node:https";

/** Hostnames used by the in-process preparation self-test allowlist (not OS-wide prep policy). */
export const ALLOWED_PREP_HOSTS = [
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "bun.sh",
  "auth.docker.io",
  "registry-1.docker.io",
  "production.cloudflare.docker.com",
  "deb.debian.org",
  "security.debian.org",
  "ftp.debian.org",
  "localhost",
  "127.0.0.1",
] as const;

export type AllowedPrepHost = (typeof ALLOWED_PREP_HOSTS)[number];

/** @deprecated Use ALLOWED_PREP_HOSTS — kept for tests referencing suffix list shape. */
export const ALLOWED_HOST_SUFFIXES = [...ALLOWED_PREP_HOSTS];

function hostAllowed(host: string | undefined): boolean {
  const normalized = (host ?? "").toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized) return false;
  return (ALLOWED_PREP_HOSTS as readonly string[]).includes(normalized);
}

function assertAllowedHost(host: string | undefined, label: string): void {
  if (!hostAllowed(host)) {
    throw new Error(`Prep egress blocked (${label}): non-allowlisted host ${host ?? "(empty)"}`);
  }
}

function extractHost(args: unknown[]): string | undefined {
  if (args.length === 0) return undefined;
  const first = args[0];
  if (typeof first === "string") {
    try {
      return new URL(first).hostname;
    } catch {
      return first.split(":")[0];
    }
  }
  if (typeof first === "object" && first != null) {
    const opts = first as { hostname?: string; host?: string };
    if (opts.hostname) return opts.hostname;
    if (opts.host) return String(opts.host).split(":")[0];
  }
  return undefined;
}

const originalFetch = globalThis.fetch?.bind(globalThis);
if (originalFetch) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assertAllowedHost(new URL(url).hostname, "fetch");
    return originalFetch(input, init);
  }) as typeof fetch;
}

function patchHttp(mod: typeof http | typeof https, label: string): void {
  const origRequest = mod.request.bind(mod);
  const origGet = mod.get.bind(mod);
  mod.request = function patchedRequest(...args: unknown[]) {
    assertAllowedHost(extractHost(args), label);
    return origRequest(...(args as Parameters<typeof origRequest>));
  } as typeof mod.request;
  mod.get = function patchedGet(...args: unknown[]) {
    assertAllowedHost(extractHost(args), label);
    return origGet(...(args as Parameters<typeof origGet>));
  } as typeof mod.get;
}

patchHttp(http, "node:http");
patchHttp(https, "node:https");

export function formatOwnerPrepAcceptanceMessage(): string {
  return "Owner acceptance recorded: proceed with the limited one-time installation risk. The spawned Bun installer and Docker daemon are not inside an OS-level exact-host network sandbox.";
}

export function formatPrepSafetyDisclosureMessage(): string {
  return `Preparation safety: credentials are stripped, dependency lifecycle scripts are disabled, the lockfile is frozen, and Docker receives an empty build context. The 11-host JavaScript allowlist (${ALLOWED_PREP_HOSTS.join(", ")}) protects the preparation self-test only. It does not restrict network traffic from the spawned Bun installer or Docker daemon.`;
}

/** @deprecated Use formatPrepSafetyDisclosureMessage — kept for tests referencing the name. */
export function formatAllowedPrepHostsMessage(): string {
  return formatPrepSafetyDisclosureMessage();
}

export { hostAllowed };
