/**
 * Vercel serverless entry — serves static client assets then TanStack Start SSR handler.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import handler from "../dist/server/server.js";

function isPhase2VercelOwnerQaBoundary(): boolean {
  return (
    process.env.PHASE2_VERCEL_OWNER_QA === "1" &&
    process.env.VERCEL_ENV === "preview"
  );
}

const CLIENT_DIR = join(process.cwd(), "dist/client");

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

function staticFileResponse(pathname: string): Response | null {
  if (pathname === "/") return null;
  const filePath = join(CLIENT_DIR, pathname);
  if (!existsSync(filePath)) return null;
  const body = readFileSync(filePath);
  const ext = extname(pathname).toLowerCase();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function withOwnerQaHeaders(response: Response): Response {
  if (!isPhase2VercelOwnerQaBoundary()) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("X-Phase2-Vercel-Owner-Qa", "1");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const staticResponse = staticFileResponse(pathname);
    if (staticResponse) return withOwnerQaHeaders(staticResponse);
    const response = await (
      handler as { fetch: (r: Request) => Response | Promise<Response> }
    ).fetch(request);
    return withOwnerQaHeaders(response);
  },
};
