import { createFileRoute } from "@tanstack/react-router";
import { getCalendarSyncSecret } from "~/server/appointmentLifecycle/config";
import { ingestCalendarWebhookEvents } from "~/server/appointmentLifecycle/syncCalendar";
import type { WebhookCalendarEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";

function isAuthorized(request: Request): boolean {
  const secret = getCalendarSyncSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("X-Calendar-Sync-Secret") === secret;
}

export const Route = createFileRoute("/api/calendar/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const body = (await request.json()) as { events?: WebhookCalendarEvent[] };
          const events = body.events ?? [];
          const processed = await ingestCalendarWebhookEvents(events);
          return new Response(JSON.stringify({ ok: true, processed }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Calendar sync webhook failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
