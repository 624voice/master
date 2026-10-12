/**
 * Fail-closed isolation runtime selection for owner-reachable safe preview.
 *
 * macOS (Chris): Docker internal network + 127.0.0.1 port publish (no Linux unshare).
 * Linux: Docker required; fail closed if Docker unavailable (no degraded fallback).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));

export type IsolationRuntime = "docker-internal";

export type IsolationPreflight = {
  os: NodeJS.Platform;
  runtime: IsolationRuntime;
  dockerInvoked: boolean;
  unshareInvoked: boolean;
  passwordlessSudoRequired: boolean;
  passwordlessSudoAvailable: boolean;
  ownerRunsOn: "host shell";
  browserRunsOn: "host OS browser (outside container/namespace)";
  ownerUrl: "http://127.0.0.1:3000";
  containerReachability: "Docker publishes container:3000 to host 127.0.0.1:3000 only";
};

export class SafePreviewIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafePreviewIsolationError";
  }
}

function commandExists(cmd: string): boolean {
  const result = spawnSync("bash", ["-lc", `command -v ${cmd}`], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

export function dockerCliPrefix(): string[] {
  if (!commandExists("docker")) return [];
  const info = spawnSync("docker", ["info"], { encoding: "utf8" });
  if (info.status === 0) return ["docker"];
  if (passwordlessSudoAvailable()) {
    const sudoInfo = spawnSync("sudo", ["-n", "docker", "info"], { encoding: "utf8" });
    if (sudoInfo.status === 0) return ["sudo", "docker"];
  }
  return [];
}

export function dockerAvailable(): boolean {
  return dockerCliPrefix().length > 0;
}

export function passwordlessSudoAvailable(): boolean {
  const result = spawnSync("sudo", ["-n", "true"], { encoding: "utf8" });
  return result.status === 0;
}

export function linuxIptablesEgressAvailable(): boolean {
  if (process.platform !== "linux") return false;
  if (!commandExists("iptables")) return false;
  return passwordlessSudoAvailable();
}

export function resolveIsolationRuntime(): IsolationPreflight {
  const os = process.platform;

  if (os === "darwin") {
    if (!dockerAvailable()) {
      throw new SafePreviewIsolationError(
        "Safe preview cannot start on macOS without Docker Desktop.\n" +
          "Install Docker Desktop, ensure it is running, then rerun:\n" +
          "  bun run scripts/phase2/start-safe-assessment-preview.ts\n" +
          "Do NOT continue with a weaker preview mode.",
      );
    }
    return {
      os,
      runtime: "docker-internal",
      dockerInvoked: true,
      unshareInvoked: false,
      passwordlessSudoRequired: false,
      passwordlessSudoAvailable: false,
      ownerRunsOn: "host shell",
      browserRunsOn: "host OS browser (outside container/namespace)",
      ownerUrl: "http://127.0.0.1:3000",
      containerReachability:
        "Docker bridge network publishes container:3000 to host 127.0.0.1:3000 only; container iptables denies external egress",
    };
  }

  if (dockerAvailable()) {
    const needsSudo = dockerCliPrefix()[0] === "sudo";
    return {
      os,
      runtime: "docker-internal",
      dockerInvoked: true,
      unshareInvoked: false,
      passwordlessSudoRequired: needsSudo,
      passwordlessSudoAvailable: needsSudo ? passwordlessSudoAvailable() : false,
      ownerRunsOn: "host shell",
      browserRunsOn: "host OS browser (outside container/namespace)",
      ownerUrl: "http://127.0.0.1:3000",
      containerReachability:
        "Docker bridge network publishes container:3000 to host 127.0.0.1:3000 only; container iptables denies external egress",
    };
  }

  throw new SafePreviewIsolationError(
    "Safe preview isolation is unavailable on this machine.\n" +
      "macOS: install and start Docker Desktop.\n" +
      "Linux: install Docker and ensure 'docker info' works (sudo docker is acceptable).\n" +
      "Do NOT run bun run build or preview outside the safe wrapper.",
  );
}

export function describeIsolationForOwner(preflight: IsolationPreflight): string[] {
  return [
    `OS: ${preflight.os}`,
    `Isolation runtime: ${preflight.runtime}`,
    `Docker invoked: ${preflight.dockerInvoked ? "yes" : "no"}`,
    `Linux unshare invoked: ${preflight.unshareInvoked ? "yes" : "no"}`,
    `Passwordless sudo required: ${preflight.passwordlessSudoRequired ? "yes (Linux iptables fallback only)" : "no"}`,
    `Owner command runs on: ${preflight.ownerRunsOn}`,
    `Owner browser runs on: ${preflight.browserRunsOn}`,
    `Owner URL: ${preflight.ownerUrl}`,
    preflight.containerReachability,
  ];
}

export { REPO_ROOT };
