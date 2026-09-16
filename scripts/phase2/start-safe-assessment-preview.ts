/**
 * Safe local preview for owner human keyboard QA (A11Y-090).
 * Fail-closed Docker internal-network isolation; host browser reaches 127.0.0.1:3000.
 */
import {
  SAFE_PREVIEW_ADAPTERS,
  SAFE_PREVIEW_BASE_URL,
} from "./safePreviewEnvironment";
import {
  depsCacheReady,
  dockerImageReady,
  buildDockerPreviewImage,
  runPrepareDepsOnHost,
  startDockerPreview,
  stopDockerPreview,
} from "./safePreviewDocker";
import {
  SafePreviewIsolationError,
  describeIsolationForOwner,
  resolveIsolationRuntime,
} from "./safePreviewIsolationRuntime";
import { waitForServer } from "../../src/browser-journey/assessmentBrowserJourneySupport";

let dockerChild: ReturnType<typeof startDockerPreview> | null = null;

function shutdown(): void {
  if (dockerChild) {
    dockerChild.kill("SIGTERM");
    stopDockerPreview();
    dockerChild = null;
  }
}

async function main(): Promise<void> {
  console.log("Phase 2 safe owner preview — human keyboard QA only");
  console.log("Do NOT use Puppeteer, Playwright, scripted input, or AI browser control.");

  const preflight = resolveIsolationRuntime();
  for (const line of describeIsolationForOwner(preflight)) {
    console.log(`Isolation: ${line}`);
  }
  if (preflight.passwordlessSudoRequired) {
    console.log("Note: this Linux host uses 'sudo docker' (passwordless sudo expected; no prompt).");
  }

  if (!depsCacheReady()) {
    console.log("Dependencies not cached. Running one-time frozen lockfile install (network allowed for install only)...");
    runPrepareDepsOnHost();
  }
  if (!dockerImageReady()) {
    console.log("Docker preview image not built. Building once (network allowed for base image + iptables)...");
    buildDockerPreviewImage();
  }

  console.log("Safe preview adapters:");
  for (const [integration, adapter] of Object.entries(SAFE_PREVIEW_ADAPTERS)) {
    console.log(`  ${integration}: ${adapter}`);
  }

  console.log("Starting Docker internal-network preview (published to host 127.0.0.1:3000 only)...");
  dockerChild = startDockerPreview(true);
  dockerChild.stdout?.on("data", (c: Buffer) => process.stdout.write(c));
  dockerChild.stderr?.on("data", (c: Buffer) => process.stdout.write(c));

  const onSignal = (): void => {
    shutdown();
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  await waitForServer(`${SAFE_PREVIEW_BASE_URL}/assessment`);
  console.log(`Safe preview ready: ${SAFE_PREVIEW_BASE_URL}`);
  console.log("Open this URL in your normal browser on this machine (browser is outside the container).");
  console.log("Confirmed: container has no external egress; host publish is loopback only.");
  console.log("Press Ctrl+C to stop and remove the container.");
  await new Promise(() => {});
}

main().catch((err) => {
  shutdown();
  console.error(err instanceof SafePreviewIsolationError ? err.message : err instanceof Error ? err.message : err);
  process.exit(1);
});
