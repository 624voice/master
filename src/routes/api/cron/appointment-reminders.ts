import { createFileRoute } from "@tanstack/react-router";
import { processAppointmentReminders } from "~/server/appointmentLifecycle/processReminders";

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

export const Route = createFileRoute("/api/cron/appointment-reminders")({
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
          const sent = await processAppointmentReminders();
          return new Response(JSON.stringify({ ok: true, sent }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Appointment reminder cron failed:", error);
          return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
