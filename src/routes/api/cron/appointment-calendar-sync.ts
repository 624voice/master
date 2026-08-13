import { createFileRoute } from "@tanstack/react-router";
import { syncCalendarFromGoogleApi } from "~/server/appointmentLifecycle/syncCalendar";

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

export const Route = createFileRoute("/api/cron/appointment-calendar-sync")({
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
          const processed = await syncCalendarFromGoogleApi();
          return new Response(JSON.stringify({ ok: true, processed }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Appointment calendar sync cron failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
