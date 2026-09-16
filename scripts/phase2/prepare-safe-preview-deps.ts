/**
 * One-time safe dependency preparation (requires network, preserves frozen lockfile).
 * Does NOT start preview or contact production integrations.
 *
 * Run: bun run scripts/phase2/prepare-safe-preview-deps.ts
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDockerPreviewImage, dockerImageReady } from "./safePreviewDocker";

const ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));
const lockHash = createHash("sha256").update(readFileSync(join(ROOT, "bun.lock"))).digest("hex");

console.log("Phase 2 safe preview — dependency preparation (network allowed for install only)");
console.log(`Lockfile SHA-256: ${lockHash}`);

const result = spawnSync("bun", ["install", "--frozen-lockfile"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, PHASE2_SAFE_PREVIEW: "1" },
});

if (result.status !== 0) {
  console.error("ERROR: frozen lockfile install failed. Do not run preview.");
  process.exit(1);
}

if (!dockerImageReady()) {
  console.log("Building Docker preview image (iptables + curl; network allowed once)...");
  buildDockerPreviewImage();
}

writeFileSync(
  join(ROOT, ".phase2-safe-preview-deps-ready"),
  `${new Date().toISOString()}\nlock=${lockHash}\n`,
);
console.log("PASS: dependencies cached for loopback-only runtime.");
console.log("Next: bun run scripts/phase2/start-safe-assessment-preview.ts");
