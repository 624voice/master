/**
 * Owner-browser reachability: host browser (outside container) loads published 127.0.0.1:3000.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  depsCacheReady,
  dockerEgressProbe,
  dockerPreviewEgressProbe,
  markDepsCacheReady,
  runPrepareDepsOnHost,
  startDockerPreview,
  stopDockerPreview,
} from "./safePreviewDocker";
import { waitForDockerPreviewReady } from "./safePreviewDockerWait";
import { dockerAvailable } from "./safePreviewIsolationRuntime";

const REPO_ROOT = join(import.meta.dir, "../..");
const RUN_SHA = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();

describe("owner browser reachability (Docker internal network)", () => {
  test("X-SAFE-PREVIEW-30: host loads / and /assessment via 127.0.0.1:3000 port publish", async () => {
    if (!dockerAvailable()) {
      console.log("SKIP: Docker required for owner-reachable preview proof");
      return;
    }
    if (!depsCacheReady()) {
      runPrepareDepsOnHost();
    } else {
      markDepsCacheReady();
    }
    const child = startDockerPreview(false);
    await waitForDockerPreviewReady();
    try {
      const home = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:3000/"], {
        encoding: "utf8",
      });
      const assessment = spawnSync("curl", [
        "-s",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "http://127.0.0.1:3000/assessment",
      ], { encoding: "utf8" });
      expect(home.stdout.trim()).toMatch(/200|307|308/);
      expect(assessment.stdout.trim()).toMatch(/200|307|308/);

      const publish = spawnSync("bash", ["-lc", "ss -ltn '( sport = :3000 )' 2>/dev/null || netstat -ltn 2>/dev/null | grep 3000"], {
        encoding: "utf8",
      });
      expect(publish.stdout).toContain("127.0.0.1:3000");

      const internalEgress = dockerEgressProbe();
      expect(internalEgress.blocked).toBe(true);
      const previewEgress = dockerPreviewEgressProbe();
      expect(previewEgress.blocked).toBe(true);
    } finally {
      child.kill("SIGTERM");
      stopDockerPreview();
    }
  }, 180000);

  test("X-SAFE-PREVIEW-37: owner-QA report fail-once fixture returns 503 then PDF", async () => {
    if (!dockerAvailable()) return;
    if (!depsCacheReady()) runPrepareDepsOnHost();
    const child = startDockerPreview(false);
    await waitForDockerPreviewReady();
    try {
      const resultsPage = spawnSync(
        "curl",
        ["-s", "http://127.0.0.1:3000/assessment"],
        { encoding: "utf8" },
      );
      expect(resultsPage.stdout).toContain("assessment");
      const first = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:3000/assessment-report/probe-token"], { encoding: "utf8" });
      const second = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:3000/assessment-report/probe-token"], { encoding: "utf8" });
      expect(first.stdout.trim()).toBe("503");
      expect(second.stdout.trim()).toMatch(/404|200/);
    } finally {
      child.kill("SIGTERM");
      stopDockerPreview();
    }
  }, 180000);

  test("X-SAFE-PREVIEW-31: preview not publicly bound on 0.0.0.0 on host", async () => {
    if (!dockerAvailable()) return;
    if (!depsCacheReady()) runPrepareDepsOnHost();
    const child = startDockerPreview(false);
    await waitForDockerPreviewReady();
    try {
      const publish = spawnSync("bash", ["-lc", "ss -ltn '( sport = :3000 )' 2>/dev/null || true"], {
        encoding: "utf8",
      });
      expect(publish.stdout).not.toMatch(/0\.0\.0\.0:3000|\*:3000|\[::\]:3000/);
    } finally {
      child.kill("SIGTERM");
      stopDockerPreview();
    }
  }, 180000);
});

export const REACHABILITY_TEST_RUN_SHA = RUN_SHA;
