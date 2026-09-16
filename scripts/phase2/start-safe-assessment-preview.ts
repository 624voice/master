/**
 * Safe local preview for owner human keyboard QA (A11Y-090).
 * Single wrapper: frozen install, sanitized build, and loopback-only preview
 * inside an isolated temporary HOME — parent shell credentials never pass through.
 *
 * Run: bun run scripts/phase2/start-safe-assessment-preview.ts
 */
import {
  SAFE_PREVIEW_ADAPTERS,
  SAFE_PREVIEW_BASE_URL,
  assertSafePreviewEnvironment,
  buildIsolatedSafePreviewEnvironment,
  createSafePreviewIsolation,
  runSanitizedBuild,
  runSanitizedInstall,
  spawnSafePreviewServer,
  stopPreviewServer,
  stopRedisStub,
  type SafePreviewIsolation,
} from "./safePreviewEnvironment";
import { waitForServer } from "../../src/browser-journey/assessmentBrowserJourneySupport";

let isolation: SafePreviewIsolation | null = null;

function ensureFrozenInstall(childEnv: Record<string, string>): void {
  const result = runSanitizedInstall(childEnv);
  if (result.status !== 0) {
    throw new Error(
      `Frozen lockfile install failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

function ensureSanitizedBuild(childEnv: Record<string, string>): void {
  const result = runSanitizedBuild(childEnv);
  if (result.status !== 0) {
    throw new Error(
      `Sanitized production build failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

function shutdown(server?: { kill: (signal: string) => void }): void {
  server?.kill("SIGTERM");
  stopPreviewServer();
  stopRedisStub();
  isolation?.cleanup();
  isolation = null;
}

async function main(): Promise<void> {
  console.log("Phase 2 safe owner preview — human keyboard QA only");
  console.log("Do NOT use Puppeteer, Playwright, scripted input, or AI browser control.");

  isolation = createSafePreviewIsolation();
  const childEnv = buildIsolatedSafePreviewEnvironment(process.env, isolation);
  assertSafePreviewEnvironment(childEnv);

  console.log("Safe preview adapters:");
  for (const [integration, adapter] of Object.entries(SAFE_PREVIEW_ADAPTERS)) {
    console.log(`  ${integration}: ${adapter}`);
  }
  console.log(`Isolated HOME: ${childEnv.HOME}`);
  console.log(`Isolated XDG_CONFIG_HOME: ${childEnv.XDG_CONFIG_HOME}`);
  console.log("Child environment verified: no prohibited credentials or live-enable flags.");

  console.log("Running bun install --frozen-lockfile inside safe boundary...");
  ensureFrozenInstall(childEnv);

  console.log("Running sanitized production build inside safe boundary...");
  ensureSanitizedBuild(childEnv);

  const server = spawnSafePreviewServer(childEnv);

  server.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  const onSignal = (): void => {
    shutdown(server);
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await waitForServer(`${SAFE_PREVIEW_BASE_URL}/assessment`);
  console.log(`Safe preview ready: ${SAFE_PREVIEW_BASE_URL}`);
  console.log("Confirmed: isolated child env, Redis stub, loopback-only egress, no live external providers.");
  console.log("Press Ctrl+C to stop the preview server and remove temporary HOME/config directories.");
  await new Promise(() => {});
}

main().catch((err) => {
  shutdown();
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
