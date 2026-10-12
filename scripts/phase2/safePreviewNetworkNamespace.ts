/**
 * OS-level loopback-only network namespace for safe preview child processes.
 */
import { spawn, spawnSync, type ChildProcess, type SpawnSyncReturns } from "node:child_process";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function wrapWithLoopbackNetworkNamespace(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): { command: string; args: string[] } {
  const inner = [command, ...args].map(shellQuote).join(" ");
  const pathExport = env?.PATH ? `export PATH=${shellQuote(env.PATH)}; ` : "";
  return {
    command: "sudo",
    args: [
      "unshare",
      "--net",
      "--",
      "bash",
      "-lc",
      `${pathExport}/sbin/ip link set lo up 2>/dev/null || ip link set lo up 2>/dev/null || true; exec ${inner}`,
    ],
  };
}

export function spawnSyncInNetworkNamespace(
  command: string,
  args: string[],
  options: Parameters<typeof spawnSync>[2],
): SpawnSyncReturns<string> {
  const wrapped = wrapWithLoopbackNetworkNamespace(command, args, options?.env as NodeJS.ProcessEnv);
  return spawnSync(wrapped.command, wrapped.args, options) as SpawnSyncReturns<string>;
}

export function spawnInNetworkNamespace(
  command: string,
  args: string[],
  options: Parameters<typeof spawn>[2],
): ChildProcess {
  const wrapped = wrapWithLoopbackNetworkNamespace(command, args, options?.env as NodeJS.ProcessEnv);
  return spawn(wrapped.command, wrapped.args, options);
}

/** Returns true when stderr/stdout indicates the OS rejected a non-loopback connection. */
export function externalConnectionWasBlocked(output: string, exitStatus: number | null): boolean {
  if (output.includes("Egress blocked")) return true;
  if (output.includes("CONNECTED")) return false;
  const blockedPatterns = [
    /ENETUNREACH/i,
    /EHOSTUNREACH/i,
    /network is unreachable/i,
    /Could not resolve host/i,
    /curl: \(6\)/,
    /curl: \(7\)/,
    /TIMEOUT/i,
  ];
  if (blockedPatterns.some((pattern) => pattern.test(output))) return true;
  return exitStatus !== 0 && exitStatus !== null;
}
