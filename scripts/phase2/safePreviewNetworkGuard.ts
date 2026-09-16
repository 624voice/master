/**
 * Preload: block outbound network except loopback. Used with loopback-only network namespace.
 */
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const GUARD_PATH = fileURLToPath(import.meta.url);

function assertLoopbackHost(host: string | undefined, label: string): void {
  const normalized = (host ?? "").replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(normalized) && !LOOPBACK_HOSTS.has(`[${normalized}]`)) {
    throw new Error(`Egress blocked (${label}): non-loopback host ${host ?? "(empty)"}`);
  }
}

function assertLoopbackUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Egress blocked (${label}): invalid URL`);
  }
  assertLoopbackHost(parsed.hostname, label);
}

function extractHostFromHttpArgs(args: unknown[]): string | undefined {
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
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    assertLoopbackUrl(url, "fetch");
    return originalFetch(input, init);
  }) as typeof fetch;
}

function patchHttpModule(mod: typeof http | typeof https, label: string): void {
  const origRequest = mod.request.bind(mod);
  const origGet = mod.get.bind(mod);
  mod.request = function patchedRequest(...args: unknown[]) {
    assertLoopbackHost(extractHostFromHttpArgs(args), label);
    return origRequest(...(args as Parameters<typeof origRequest>));
  } as typeof mod.request;
  mod.get = function patchedGet(...args: unknown[]) {
    assertLoopbackHost(extractHostFromHttpArgs(args), label);
    return origGet(...(args as Parameters<typeof origGet>));
  } as typeof mod.get;
}

patchHttpModule(http, "node:http");
patchHttpModule(https, "node:https");

const originalTlsConnect = tls.connect.bind(tls);
(tls as { connect: typeof tls.connect }).connect = function patchedTlsConnect(...args: unknown[]) {
  if (typeof args[0] === "object" && args[0] != null) {
    const opts = args[0] as { host?: string; hostname?: string; servername?: string };
    assertLoopbackHost(opts.host ?? opts.hostname ?? opts.servername, "node:tls");
  } else if (typeof args[1] === "string") {
    assertLoopbackHost(args[1], "node:tls");
  }
  return originalTlsConnect(...(args as Parameters<typeof tls.connect>));
} as typeof tls.connect;

if (typeof globalThis.WebSocket !== "undefined") {
  const OriginalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class GuardedWebSocket extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      assertLoopbackUrl(String(url), "WebSocket");
      super(url, protocols);
    }
  } as typeof WebSocket;
}

declare global {
  var Bun: { connect?: (options: { hostname?: string; port?: number }) => unknown };
}

if (typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun.connect === "function") {
  const originalBunConnect = globalThis.Bun.connect.bind(globalThis.Bun);
  globalThis.Bun.connect = ((options: { hostname?: string; port?: number }) => {
    if (options?.hostname) assertLoopbackHost(options.hostname, "Bun.connect");
    return originalBunConnect(options);
  }) as typeof globalThis.Bun.connect;
}

export { assertLoopbackUrl, assertLoopbackHost, LOOPBACK_HOSTS, GUARD_PATH };
