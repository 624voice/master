/**
 * Safe local preview for owner human keyboard QA (A11Y-090).
 * Builds an isolated child-process environment — parent shell credentials never pass through.
 *
 * Run: bun run scripts/phase2/start-safe-assessment-preview.ts
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SAFE_PREVIEW_ADAPTERS,
  SAFE_PREVIEW_BASE_URL,
  assertSafePreviewEnvironment,
  buildIsolatedSafePreviewEnvironment,
  spawnSafePreviewServer,
  stopPreviewServer,
  stopRedisStub,
} from "./safePreviewEnvironment";
import { waitForServer } from "../../src/browser-journey/assessmentBrowserJourneySupport";

const REPO_ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));

function ensureBuild(): void {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `Production build failed: ${result.stderr?.toString() ?? "unknown error"}`,
    );
  }
}

async function main(): Promise<void> {
  console.log("Phase 2 safe owner preview — human keyboard QA only");
  console.log("Do NOT use Puppeteer, Playwright, scripted input, or AI browser control.");

  const childEnv = buildIsolatedSafePreviewEnvironment(process.env);
  assertSafePreviewEnvironment(childEnv);

  console.log("Safe preview adapters:");
  for (const [integration, adapter] of Object.entries(SAFE_PREVIEW_ADAPTERS)) {
    console.log(`  ${integration}: ${adapter}`);
  }
  console.log("Child environment verified: no prohibited credentials or live-enable flags.");

  await ensureBuild();
  const server = spawnSafePreviewServer(childEnv);

  server.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  const shutdown = (): void => {
    server.kill("SIGTERM");
    stopPreviewServer();
    stopRedisStub();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await waitForServer(`${SAFE_PREVIEW_BASE_URL}/assessment`);
  console.log(`Safe preview ready: ${SAFE_PREVIEW_BASE_URL}`);
  console.log("Confirmed: isolated child env, Redis stub, no live external providers.");
  console.log("Press Ctrl+C to stop the preview server.");
  await new Promise(() => {});
}

main().catch((err) => {
  stopPreviewServer();
  stopRedisStub();
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
