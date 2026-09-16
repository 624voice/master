/**
 * Docker safe preview — bridge network for host port publish + iptables egress deny.
 * Internal network retained only for standalone egress probe containers.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, dockerCliPrefix } from "./safePreviewIsolationRuntime";

/** Bridge network: supports -p 127.0.0.1:3000 publish (internal networks do not). */
export const DOCKER_BRIDGE_NETWORK = "phase2-safe-preview-bridge";
/** Internal network: egress probe only. */
export const DOCKER_INTERNAL_NETWORK = "phase2-safe-preview-internal";
export const DOCKER_CONTAINER = "phase2-safe-preview-runtime";
export const DOCKER_IMAGE = "phase2-safe-preview-runtime:local";

function docker(args: string[], options?: { inherit?: boolean }): ReturnType<typeof spawnSync> {
  const prefix = dockerCliPrefix();
  if (prefix.length === 0) {
    return { status: 1, stdout: "", stderr: "docker unavailable", pid: 0, output: [null, "", ""], signal: null, error: undefined } as ReturnType<typeof spawnSync>;
  }
  const cmd = prefix[0]!;
  const cmdArgs = prefix.length > 1 ? [...prefix.slice(1), ...args] : args;
  return spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: options?.inherit ? "inherit" : "pipe",
  });
}

function ensureNetwork(name: string, internal: boolean): void {
  const inspect = docker(["network", "inspect", name]);
  if (inspect.status === 0) return;
  const args = internal ? ["network", "create", "--internal", name] : ["network", "create", name];
  const create = docker(args);
  if (create.status !== 0) {
    throw new Error(`Failed to create Docker network ${name}: ${create.stderr ?? create.stdout}`);
  }
}

export function ensureDockerNetworks(): void {
  ensureNetwork(DOCKER_BRIDGE_NETWORK, false);
  ensureNetwork(DOCKER_INTERNAL_NETWORK, true);
}

export function dockerImageReady(): boolean {
  const inspect = docker(["image", "inspect", DOCKER_IMAGE]);
  return inspect.status === 0;
}

/** One-time image build (network allowed); includes iptables for fail-closed egress deny. */
export function buildDockerPreviewImage(): void {
  const result = docker(
    [
      "build",
      "-f",
      "scripts/phase2/docker/Dockerfile.safe-preview",
      "-t",
      DOCKER_IMAGE,
      ".",
    ],
    { inherit: true },
  );
  if (result.status !== 0) {
    throw new Error("Failed to build phase2-safe-preview-runtime Docker image");
  }
}

export function ensureDockerPreviewImage(): void {
  if (!dockerImageReady()) buildDockerPreviewImage();
}

export function depsCacheReady(): boolean {
  return (
    existsSync(join(REPO_ROOT, "node_modules")) &&
    existsSync(join(REPO_ROOT, "bun.lock")) &&
    existsSync(join(REPO_ROOT, ".phase2-safe-preview-deps-ready"))
  );
}

export function markDepsCacheReady(): void {
  spawnSync("bash", ["-lc", `date -Iseconds > ${join(REPO_ROOT, ".phase2-safe-preview-deps-ready")}`], {
    cwd: REPO_ROOT,
  });
}

/** Safe one-time prep with network — frozen lockfile only, no runtime preview. */
export function runPrepareDepsOnHost(): void {
  const result = spawnSync("bun", ["install", "--frozen-lockfile"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, PHASE2_SAFE_PREVIEW: "1" },
  });
  if (result.status !== 0) {
    throw new Error("prepare-safe-preview-deps: bun install --frozen-lockfile failed");
  }
  markDepsCacheReady();
}

export function dockerEgressProbe(): { blocked: boolean; output: string } {
  ensureDockerNetworks();
  ensureDockerPreviewImage();
  const probe = docker([
    "run",
    "--rm",
    "--network",
    DOCKER_INTERNAL_NETWORK,
    DOCKER_IMAGE,
    "bash",
    "-lc",
    "code=0; curl -s --max-time 3 https://example.com >/dev/null || code=$?; echo CURL_EXIT:$code",
  ]);
  const output = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  return {
    blocked: /CURL_EXIT:(6|7|28|127)/.test(output) || probe.status !== 0,
    output,
  };
}

export function dockerPreviewEgressProbe(): { blocked: boolean; output: string } {
  const probe = dockerExec([
    "bash",
    "-lc",
    "code=0; curl -s --max-time 3 https://example.com >/dev/null || code=$?; echo CURL_EXIT:$code",
  ]);
  const output = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
  return {
    blocked: /CURL_EXIT:(6|7|28|35)/.test(output) || probe.status !== 0,
    output,
  };
}

export function startDockerPreview(followLogs: boolean): ChildProcess {
  ensureDockerNetworks();
  ensureDockerPreviewImage();
  docker(["rm", "-f", DOCKER_CONTAINER]);

  const prefix = dockerCliPrefix();
  const child = spawn(prefix[0]!, [...prefix.slice(1), "run",
      "--name",
      DOCKER_CONTAINER,
      "--network",
      DOCKER_BRIDGE_NETWORK,
      "--cap-add",
      "NET_ADMIN",
      "-p",
      "127.0.0.1:3000:3000",
      "-v",
      `${REPO_ROOT}:/app`,
      "-w",
      "/app",
      "-e",
      "PHASE2_SAFE_PREVIEW=1",
      "-e",
      "PHASE2_DOCKER_RUNTIME=1",
      DOCKER_IMAGE,
      "bash",
      "scripts/phase2/docker/safe-preview-entrypoint.sh"],
    {
      cwd: REPO_ROOT,
      stdio: followLogs ? ["ignore", "pipe", "pipe"] : "pipe",
    },
  );
  return child;
}

export function stopDockerPreview(): void {
  docker(["rm", "-f", DOCKER_CONTAINER]);
}

export function dockerExec(args: string[]): ReturnType<typeof spawnSync> {
  return docker(["exec", DOCKER_CONTAINER, ...args]);
}

export function readPublishedBind(): string {
  const ps = docker(["port", DOCKER_CONTAINER, "3000/tcp"]);
  const line = (ps.stdout ?? "").trim().split("\n")[0] ?? "";
  return line || "127.0.0.1:3000";
}
