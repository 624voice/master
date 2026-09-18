/**
 * CLI probe for safe-preview network guard (used by tests).
 * Usage: bun --env-file=/dev/null scripts/phase2/safePreviewNetworkProbe.ts <url>
 */
import "./safePreviewNetworkGuard.ts";
const url = process.argv[2];
if (!url) {
  console.error("usage: safePreviewNetworkProbe.ts <url>");
  process.exit(3);
}
function isLoopbackTarget(target: string): boolean {
  try {
    const host = new URL(target).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

try {
  await fetch(url);
  console.error(`FAIL: non-loopback request succeeded (${url})`);
  process.exit(1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (isLoopbackTarget(url)) process.exit(0);
  console.log("PASS: non-loopback request was blocked");
  process.exit(0);
}
