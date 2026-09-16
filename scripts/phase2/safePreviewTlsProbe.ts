import { assertLoopbackHost } from "./safePreviewNetworkGuard.ts";
import tls from "node:tls";

const host = process.argv[2] ?? "example.com";
try {
  assertLoopbackHost(host, "node:tls");
} catch {
  process.exit(0);
}

let done = false;
const socket = tls.connect(443, host);
socket.on("secureConnect", () => {
  if (!done) {
    done = true;
    process.exit(1);
  }
});
socket.on("error", () => {
  if (!done) {
    done = true;
    process.exit(0);
  }
});
setTimeout(() => process.exit(0), 800);
