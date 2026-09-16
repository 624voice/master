/**
 * Loopback-only preview server for Phase 2 owner keyboard QA.
 * Adds CSP headers blocking non-loopback browser requests when PHASE2_SAFE_PREVIEW=1.
 */
import "./safePreviewNetworkGuard.ts";
import handler from "../../dist/server/server.js";
import { SAFE_PREVIEW_CSP_HEADER } from "./safePreviewCsp.ts";

const PORT = 3000;
const HOST = process.env.PHASE2_DOCKER_RUNTIME === "1" ? "0.0.0.0" : "127.0.0.1";
const CLIENT_DIR = `${import.meta.dir}/../../dist/client`;
const IS_SAFE_PREVIEW = process.env.PHASE2_SAFE_PREVIEW === "1";

function withSafeHeaders(response: Response): Response {
  if (!IS_SAFE_PREVIEW) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", SAFE_PREVIEW_CSP_HEADER);
  headers.set("X-Phase2-Safe-Preview", "1");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const freePort =
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi`;

await Bun.$`sh -c ${freePort}`.quiet().nothrow();

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname !== "/") {
      const file = Bun.file(CLIENT_DIR + pathname);
      if (await file.exists()) return withSafeHeaders(new Response(file));
    }
    const response = await (
      handler as { fetch: (r: Request) => Response | Promise<Response> }
    ).fetch(req);
    return withSafeHeaders(response);
  },
});

console.log(`Phase 2 safe preview serving on http://${HOST}:${String(PORT)}`);
