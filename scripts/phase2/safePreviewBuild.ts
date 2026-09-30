/**
 * Sanitized production build inside safe preview boundary.
 */
import "./safePreviewNetworkGuard.ts";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));
const result = spawnSync("bun", ["--env-file=/dev/null", "run", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
