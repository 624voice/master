/**
 * Secret-safe preparation negative tests — never mutates repo secret files.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMinimalDockerBuildContext,
  dockerBuildCommand,
  inspectDockerPreviewImage,
  readDockerfileInstructions,
  sha256File,
} from "./safePreviewDockerBuild";
import { DOCKER_IMAGE } from "./safePreviewDocker";
import {
  assertPrepareEnvironment,
  buildIsolatedPrepareEnvironment,
} from "./safePreviewPrepareEnvironment";
import { runSecurePrepareDeps } from "./prepare-safe-preview-deps";

const REPO_ROOT = join(import.meta.dir, "../..");

const FAKE_MARKERS = {
  twilio: "FAKE_PREP_PROBE_TWILIO_SID_AC999999999",
  sendgrid: "FAKE_PREP_PROBE_SENDGRID_SG.fake.probe",
  upstash: "https://fake-prep-probe.upstash.io",
  openai: "sk-FAKE_PREP_PROBE_OPENAI_KEY",
  netrc: "FAKE_PREP_PROBE_NETRC_SECRET_LINE",
  npmrc: "FAKE_PREP_PROBE_NPM_TOKEN",
} as const;

function dockerAvailable(): boolean {
  if (spawnSync("docker", ["info"], { encoding: "utf8" }).status === 0) return true;
  return spawnSync("sudo", ["-n", "docker", "info"], { encoding: "utf8" }).status === 0;
}

describe("prepare-safe-preview-deps secret safety", () => {
  test("X-SAFE-PREP-01: lockfile byte-identical before and after preparation", () => {
    const before = sha256File(join(REPO_ROOT, "bun.lock"));
    const result = runSecurePrepareDeps({ skipDocker: true, quiet: true });
    expect(result.lockBefore).toBe(before);
    expect(result.lockAfter).toBe(before);
    expect(result.installExit).toBe(0);
  });

  test("X-SAFE-PREP-02: preparation child env excludes fake parent credentials", () => {
    const { env, isolation } = buildIsolatedPrepareEnvironment({
      ...process.env,
      TWILIO_ACCOUNT_SID: FAKE_MARKERS.twilio,
      SENDGRID_API_KEY: FAKE_MARKERS.sendgrid,
      OPENAI_API_KEY: FAKE_MARKERS.openai,
      UPSTASH_REDIS_REST_URL: FAKE_MARKERS.upstash,
      NETRC: "/fake/prep/.netrc",
    });
    try {
      assertPrepareEnvironment(env);
      const serialized = JSON.stringify(env);
      for (const marker of Object.values(FAKE_MARKERS)) {
        expect(serialized.includes(marker)).toBe(false);
      }
      expect(env.TWILIO_ACCOUNT_SID).toBeUndefined();
      expect(env.HOME).toContain("phase2-safe-preview-");
    } finally {
      isolation.cleanup();
    }
  });

  test("X-SAFE-PREP-03: prep egress blocks Twilio, SendGrid, Upstash, Google, CRM, analytics, agent destinations", () => {
    const probe = spawnSync(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/safePreviewPrepareEgressProbe.ts"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    const jsonLine = probe.stdout.split("\n").find((l) => l.startsWith("PHASE2_EGRESS_PROBE_JSON:"));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine!.slice("PHASE2_EGRESS_PROBE_JSON:".length)) as {
      results: Array<{
        label: string;
        url: string;
        hostname: string;
        networkApi: string;
        outcome: string;
        errorMessage: string | null;
      }>;
      blocked: number;
      total: number;
    };
    expect(parsed.total).toBe(7);
    expect(parsed.blocked).toBe(7);
    for (const dest of parsed.results) {
      expect(dest.networkApi).toBe("fetch");
      expect(dest.outcome).toBe("policy_blocked");
      expect(dest.errorMessage).toContain("Prep egress blocked");
      expect(dest.errorMessage).toContain(dest.hostname);
    }
    expect(probe.stdout).toContain(
      "PASS: preparation blocked 7/7 integration destinations via Prep egress blocked",
    );
  });

  test("X-SAFE-PREP-04: Docker build uses minimal context; Dockerfile has no COPY/ADD", () => {
    const ctx = createMinimalDockerBuildContext();
    try {
      expect(ctx.files).toEqual([".dockerignore"]);
      expect(readDockerfileInstructions()).toEqual([]);
      const cmd = dockerBuildCommand(ctx.contextDir);
      expect(cmd).toContain("phase2-docker-context-");
      expect(cmd).toMatch(/phase2-docker-context-/);
      expect(cmd).not.toMatch(/\s\.\s*$/);
    } finally {
      ctx.cleanup();
    }
  });

  test("X-SAFE-PREP-05: isolated temp workspace — fake secrets absent from output and image layers", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "phase2-prep-probe-"));
    const tempRepo = join(tempRoot, "repo");
    mkdirSync(join(tempRepo, "scripts"), { recursive: true });

    for (const item of ["package.json", "bun.lock"]) {
      cpSync(join(REPO_ROOT, item), join(tempRepo, item));
    }
    cpSync(join(REPO_ROOT, "scripts/phase2"), join(tempRepo, "scripts/phase2"), { recursive: true });

    writeFileSync(join(tempRepo, ".env"), `TWILIO_ACCOUNT_SID=${FAKE_MARKERS.twilio}\n`);
    writeFileSync(join(tempRepo, ".env.local"), `SENDGRID_API_KEY=${FAKE_MARKERS.sendgrid}\n`);
    mkdirSync(join(tempRoot, "fake-home"), { recursive: true });
    writeFileSync(join(tempRoot, "fake-home", ".netrc"), FAKE_MARKERS.netrc);
    writeFileSync(join(tempRoot, "fake-npmrc"), FAKE_MARKERS.npmrc);

    const run = spawnSync(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/prepare-safe-preview-deps.ts"],
      {
        cwd: tempRepo,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          PHASE2_PREP_ROOT: tempRepo,
          PHASE2_PREP_SKIP_DOCKER: "1",
          TWILIO_ACCOUNT_SID: FAKE_MARKERS.twilio,
          SENDGRID_API_KEY: FAKE_MARKERS.sendgrid,
          OPENAI_API_KEY: FAKE_MARKERS.openai,
          HOME: join(tempRoot, "fake-home"),
          NETRC: join(tempRoot, "fake-home", ".netrc"),
          NPM_CONFIG_USERCONFIG: join(tempRoot, "fake-npmrc"),
        },
      },
    );
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    for (const marker of Object.values(FAKE_MARKERS)) {
      expect(output.includes(marker)).toBe(false);
    }
    if (run.status !== 0) {
      console.log("temp prep output:", output.slice(-800));
    }
    expect(run.status).toBe(0);

    if (dockerAvailable()) {
      const { env, isolation } = buildIsolatedPrepareEnvironment(process.env);
      try {
        const inspection = inspectDockerPreviewImage(env);
        const blob = JSON.stringify(inspection);
        for (const marker of Object.values(FAKE_MARKERS)) {
          expect(blob.includes(marker)).toBe(false);
        }
      } finally {
        isolation.cleanup();
      }
    }

    rmSync(tempRoot, { recursive: true, force: true });
  }, 300000);
});
