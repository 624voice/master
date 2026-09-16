/**
 * Preload: block outbound network except loopback. Used only for safe preview child processes.
 */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function assertLoopbackUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Egress blocked (${label}): invalid URL`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Egress blocked (${label}): non-loopback host ${parsed.hostname}`);
  }
}

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  assertLoopbackUrl(url, "fetch");
  return originalFetch(input, init);
}) as typeof fetch;

import { connect as netConnect, type NetConnectOpts } from "node:net";
import { connect as tlsConnect, type ConnectionOptions } from "node:tls";

function assertLoopbackHost(host: string | undefined, label: string): void {
  const normalized = (host ?? "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(normalized)) {
    throw new Error(`Egress blocked (${label}): non-loopback host ${host ?? "(empty)"}`);
  }
}

const patchedNetConnect = function patchedNetConnect(
  ...args: [NetConnectOpts | number, ...unknown[]]
) {
  if (typeof args[0] === "object" && args[0] != null && "host" in args[0]) {
    assertLoopbackHost(String((args[0] as NetConnectOpts).host), "net.connect");
  } else if (typeof args[0] === "string") {
    assertLoopbackHost(args[0], "net.connect");
  }
  return netConnect.apply(null, args as never);
} as typeof netConnect;

export { assertLoopbackUrl, LOOPBACK_HOSTS };
