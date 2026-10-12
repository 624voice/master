/**
 * Server-side WebSocket probe. Application has no WebSocket client/server paths in src/;
 * this validates the preload guard when WebSocket global exists.
 */
import "./safePreviewNetworkGuard.ts";

if (typeof WebSocket === "undefined") {
  console.log("SKIP: WebSocket global unavailable in this runtime");
  process.exit(0);
}

try {
  new WebSocket("wss://example.com/socket");
  process.exit(1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Egress blocked")) process.exit(0);
  process.exit(2);
}
