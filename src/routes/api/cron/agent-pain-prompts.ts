import { createFileRoute } from "@tanstack/react-router";
import { processPendingPainPrompts } from "~/server/speed2Lead/agent/painPrompt";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("X-Cron-Secret") === secret;
}

export const Route = createFileRoute("/api/cron/agent-pain-prompts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const sent = await processPendingPainPrompts();
          return new Response(JSON.stringify({ ok: true, sent }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Speed2Lead agent pain-prompt cron failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
