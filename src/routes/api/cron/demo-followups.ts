import { createFileRoute } from "@tanstack/react-router";
import { processAbandonedDemoRecovery } from "~/server/speed2Lead/agent/demoFlow/abandonedRecovery";
import { isSpeed2LeadDemoAgentV2Enabled } from "~/server/speed2Lead/agent/rollout";
import { processDemoFollowUps } from "~/server/demoSpeed2Lead/processFollowUps";
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

export const Route = createFileRoute("/api/cron/demo-followups")({
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
          await recordCronRun("demo-followups");
          const sent = isSpeed2LeadDemoAgentV2Enabled()
            ? await processAbandonedDemoRecovery()
            : await processDemoFollowUps();
          return new Response(JSON.stringify({ ok: true, sent }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Demo follow-up cron failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
