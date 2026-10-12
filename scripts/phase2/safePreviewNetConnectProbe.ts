import "./safePreviewNetworkGuard.ts";
import net from "node:net";

const host = process.argv[2] ?? "example.com";
const port = Number(process.argv[3] ?? "443");
let finished = false;
const socket = net.connect(port, host);
socket.on("connect", () => {
  if (!finished) {
    finished = true;
    process.exit(1);
  }
});
socket.on("error", () => {
  if (!finished) {
    finished = true;
    process.exit(0);
  }
});
setTimeout(() => process.exit(0), 800);
