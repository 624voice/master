import "./safePreviewNetworkGuard.ts";
import http from "node:http";

const url = process.argv[2] ?? "http://example.com/";
let finished = false;
try {
  const req = http.get(url, () => {
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
