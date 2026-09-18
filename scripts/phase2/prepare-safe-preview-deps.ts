/**
 * One-time secret-safe dependency preparation (network allowed for registries only).
 *
 * Run: bun run scripts/phase2/prepare-safe-preview-deps.ts
 */
import "./safePreviewPrepareNetworkGuard.ts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDockerPreviewImageIsolated,
  dockerBuildCommand,
  ensureDockerEmptyConfig,
  inspectDockerPreviewImage,
  readDockerfileInstructions,
  sha256File,
  createMinimalDockerBuildContext,
} from "./safePreviewDockerBuild";
import { DOCKER_IMAGE, dockerImageReady } from "./safePreviewDocker";
import { dockerAvailable } from "./safePreviewIsolationRuntime";
import {
  assertPrepareEnvironment,
  buildIsolatedPrepareEnvironment,
  PREP_BOUNDARY,
  redactForLogs,
} from "./safePreviewPrepareEnvironment";

const ROOT =
  process.env.PHASE2_PREP_ROOT?.trim() ||
  join(fileURLToPath(new URL("../..", import.meta.url)));
const LOCK_PATH = join(ROOT, "bun.lock");
const READY_PATH = join(ROOT, ".phase2-safe-preview-deps-ready");

export type SecurePrepareResult = {
  lockBefore: string;
  lockAfter: string;
  installExit: number;
  dockerBuildExit: number;
  dockerCommand: string;
  contextFiles: string[];
  dockerfileCopyAdd: string[];
  imageInspection: ReturnType<typeof inspectDockerPreviewImage> | null;
};

export function runSecurePrepareDeps(options?: {
  skipDocker?: boolean;
  quiet?: boolean;
}): SecurePrepareResult {
  if (process.env.PHASE2_PREP_SKIP_DOCKER === "1") {
    options = { ...options, skipDocker: true };
  }
  const { env, isolation } = buildIsolatedPrepareEnvironment(process.env);
  try {
    assertPrepareEnvironment(env);
    ensureDockerEmptyConfig(env);

    const lockBefore = sha256File(LOCK_PATH);
    if (!options?.quiet) {
      console.log("Phase 2 safe preview — secret-safe one-time preparation");
      console.log(`Lockfile SHA-256 (before): ${lockBefore}`);
      console.log("Lifecycle scripts: disabled (--ignore-scripts); package.json defines no install scripts.");
      console.log(
        "Allowed network: exact prep hosts only (registry.npmjs.org, bun.sh, auth.docker.io, registry-1.docker.io, production.cloudflare.docker.com, deb.debian.org, security.debian.org, ftp.debian.org, localhost).",
      );
    }

    const integrationProbe = spawnSync(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/safePreviewPrepareEgressProbe.ts"],
      { cwd: ROOT, env, encoding: "utf8" },
    );
    if (integrationProbe.status !== 0) {
      throw new Error("ERROR: preparation egress policy failed (integration destination reachable).");
    }

    const install = spawnSync(
      "bun",
      ["--env-file=/dev/null", "install", "--frozen-lockfile", "--ignore-scripts"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: options?.quiet ? "pipe" : "inherit",
        env,
      },
    );

    const lockAfter = sha256File(LOCK_PATH);
    if (lockBefore !== lockAfter) {
      throw new Error("ERROR: bun.lock changed during frozen install. Do not continue.");
    }
    if (install.status !== 0) {
      throw new Error("ERROR: frozen lockfile install failed. Do not run preview.");
    }

    let dockerBuildExit = 0;
    let dockerCommand = "";
    let contextFiles: string[] = [];
    let imageInspection: ReturnType<typeof inspectDockerPreviewImage> | null = null;

    if (!options?.skipDocker && !dockerImageReady()) {
      if (!dockerAvailable()) {
        throw new Error(
          "ERROR: Docker is unavailable. Start Docker Desktop (macOS) or ensure docker info works, then rerun preparation.\nDo NOT continue.",
        );
      }
      if (!options?.quiet) {
        console.log("Building Docker preview image (minimal empty context; no repo COPY)...");
      }
      const sampleCtx = createMinimalDockerBuildContext();
      dockerCommand = dockerBuildCommand(sampleCtx.contextDir);
      contextFiles = sampleCtx.files;
      sampleCtx.cleanup();

      const build = buildDockerPreviewImageIsolated(env);
      dockerBuildExit = build.status;
      dockerCommand = build.command;
      contextFiles = build.contextFiles;
      if (dockerBuildExit !== 0) {
        const log = redactForLogs(build.buildLog, []);
        throw new Error(`ERROR: Docker image build failed.\n${log.slice(-1200)}`);
      }
      imageInspection = inspectDockerPreviewImage(env);
    }

    writeFileSync(
      READY_PATH,
      `${new Date().toISOString()}\nlock=${lockAfter}\n${PREP_BOUNDARY}=1\n`,
    );

    if (!options?.quiet) {
      console.log(`Lockfile SHA-256 (after):  ${lockAfter} (unchanged)`);
      console.log("PASS: secret-safe preparation complete.");
      console.log("Next: bun run scripts/phase2/start-safe-assessment-preview.ts");
    }

    return {
      lockBefore,
      lockAfter,
      installExit: install.status ?? 1,
      dockerBuildExit,
      dockerCommand,
      contextFiles,
      dockerfileCopyAdd: readDockerfileInstructions(),
      imageInspection,
    };
  } finally {
    isolation.cleanup();
  }
}

if (import.meta.main) {
  try {
    runSecurePrepareDeps();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
