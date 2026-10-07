/**
 * Minimal Docker build context and image inspection for safe preview preparation.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, dockerCliPrefix } from "./safePreviewIsolationRuntime";
import { DOCKER_IMAGE } from "./safePreviewDocker";

export const DOCKERFILE_PATH = join(REPO_ROOT, "scripts/phase2/docker/Dockerfile.safe-preview");
export const DOCKERIGNORE_SOURCE = join(REPO_ROOT, "scripts/phase2/docker/.dockerignore");

function docker(args: string[], env: Record<string, string>, inherit = false): ReturnType<typeof spawnSync> {
  const prefix = dockerCliPrefix();
  if (prefix.length === 0) {
    return { status: 1, stdout: "", stderr: "docker unavailable", pid: 0, output: [null, "", ""], signal: null, error: undefined } as ReturnType<typeof spawnSync>;
  }
  const cmd = prefix[0]!;
  const cmdArgs = prefix.length > 1 ? [...prefix.slice(1), ...args] : args;
  return spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    env,
  });
}

/** Deliberately minimal context — Dockerfile has no COPY/ADD from context. */
export function createMinimalDockerBuildContext(): { contextDir: string; files: string[]; cleanup: () => void } {
  const contextDir = mkdtempSync(join(tmpdir(), "phase2-docker-context-"));
  const dockerignoreDest = join(contextDir, ".dockerignore");
  cpSync(DOCKERIGNORE_SOURCE, dockerignoreDest);
  const files = readdirSync(contextDir).sort();
  return {
    contextDir,
    files,
    cleanup: () => {
      try {
        rmSync(contextDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}

export function dockerBuildCommand(contextDir: string): string {
  const prefix = dockerCliPrefix();
  const dockerBin = prefix.join(" ");
  return `${dockerBin} build -f ${DOCKERFILE_PATH} -t ${DOCKER_IMAGE} ${contextDir}`.trim();
}

export function readDockerfileInstructions(): string[] {
  const lines = readFileSync(DOCKERFILE_PATH, "utf8").split("\n");
  return lines.filter((line) => /^\s*(COPY|ADD)\s/i.test(line));
}

export function buildDockerPreviewImageIsolated(env: Record<string, string>): {
  status: number;
  command: string;
  contextDir: string;
  contextFiles: string[];
  buildLog: string;
} {
  const ctx = createMinimalDockerBuildContext();
  const command = dockerBuildCommand(ctx.contextDir);
  try {
    const result = docker(
      ["build", "-f", DOCKERFILE_PATH, "-t", DOCKER_IMAGE, ctx.contextDir],
      env,
      false,
    );
    const buildLog = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return {
      status: result.status ?? 1,
      command,
      contextDir: ctx.contextDir,
      contextFiles: ctx.files,
      buildLog,
    };
  } finally {
    ctx.cleanup();
  }
}

export type DockerImageInspection = {
  configEnv: string[];
  configLabels: Record<string, string>;
  history: string;
  rootFilesystemSample: string;
  layerArchiveScan: string;
};

export function inspectDockerPreviewImage(env: Record<string, string>): DockerImageInspection {
  const inspect = docker(["inspect", DOCKER_IMAGE], env);
  const parsed = JSON.parse(inspect.stdout || "[]") as Array<{
    Config?: { Env?: string[]; Labels?: Record<string, string> };
  }>;
  const configEnv = parsed[0]?.Config?.Env ?? [];
  const configLabels = parsed[0]?.Config?.Labels ?? {};

  const history = docker(["history", "--no-trunc", DOCKER_IMAGE], env);
  const rootFs = docker(
    ["run", "--rm", "--entrypoint", "find", DOCKER_IMAGE, "/", "-maxdepth", "3", "-type", "f"],
    env,
  );
  const save = docker(["save", DOCKER_IMAGE, "-o", "/dev/stdout"], env);
  const layerScan =
    save.status === 0
      ? scanTarForMarkers(save.stdout ?? "", ["TWILIO_", "SENDGRID_", ".env", "FAKE_PREP_PROBE"])
      : `save-failed:${save.stderr ?? ""}`;

  return {
    configEnv,
    configLabels,
    history: `${history.stdout ?? ""}${history.stderr ?? ""}`.trim(),
    rootFilesystemSample: `${rootFs.stdout ?? ""}`.trim().split("\n").slice(0, 40).join("\n"),
    layerArchiveScan: layerScan,
  };
}

function scanTarForMarkers(data: string, markers: string[]): string {
  const hits: string[] = [];
  for (const marker of markers) {
    if (data.includes(marker)) hits.push(marker);
  }
  return hits.length ? `markers-found:${hits.join(",")}` : "no-markers-in-save-stream";
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function ensureDockerEmptyConfig(env: Record<string, string>): void {
  const dir = env.DOCKER_CONFIG;
  if (!dir) return;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, "config.json"), "{}\n", { mode: 0o600 });
}
