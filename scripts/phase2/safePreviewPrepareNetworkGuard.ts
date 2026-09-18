/**
 * Preparation-time egress guard: allow package/container registries only.
 * Blocks representative production-integration destinations during prep.
 */
import http from "node:http";
import https from "node:https";

const ALLOWED_HOST_SUFFIXES = [
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "bun.sh",
  "github.com",
  "objects.githubusercontent.com",
  "docker.io",
  "auth.docker.io",
  "registry-1.docker.io",
  "production.cloudflare.docker.com",
  "deb.debian.org",
  "security.debian.org",
  "ftp.debian.org",
  "azureedge.net",
  "cloudfront.net",
  "amazonaws.com",
  "googleapis.com",
  "gcr.io",
  "ghcr.io",
  "localhost",
  "127.0.0.1",
];

function hostAllowed(host: string | undefined): boolean {
  const normalized = (host ?? "").toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized) return false;
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
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

export { ALLOWED_HOST_SUFFIXES, hostAllowed };
