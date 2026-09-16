import "./safePreviewNetworkGuard.ts";
import https from "node:https";

const url = process.argv[2] ?? "https://example.com/";
let finished = false;
try {
  const req = https.get(url, () => {
    if (!finished) {
      finished = true;
      process.exit(1);
    }
  });
  req.on("error", () => {
    if (!finished) {
      finished = true;
      process.exit(0);
    }
  });
} catch (e) {
  if (String(e).includes("Egress blocked")) process.exit(0);
  process.exit(2);
}
setTimeout(() => process.exit(0), 800);
