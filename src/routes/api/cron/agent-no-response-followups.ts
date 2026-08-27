import { createFileRoute } from "@tanstack/react-router";
import { processPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { recordCronRun } from "~/server/speed2Lead/cronHeartbeat";

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

export const Route = createFileRoute("/api/cron/agent-no-response-followups")({
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
          await recordCronRun("agent-no-response-followups");
          const sent = await processPendingNoResponseCampaign();
          return new Response(JSON.stringify({ ok: true, sent }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Speed2Lead agent no-response cron failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
