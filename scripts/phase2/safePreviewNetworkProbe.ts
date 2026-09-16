/**
 * CLI probe for safe-preview network guard (used by tests).
 * Usage: bun --preload safePreviewNetworkGuard.ts scripts/phase2/safePreviewNetworkProbe.ts <url>
 */
const url = process.argv[2];
if (!url) {
  console.error("usage: safePreviewNetworkProbe.ts <url>");
  process.exit(3);
}
try {
  await fetch(url);
  process.exit(1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Egress blocked")) process.exit(0);
  process.exit(2);
}
