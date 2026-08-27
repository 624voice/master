import { createFileRoute } from "@tanstack/react-router";
import { handleCalendarOAuthSmokeRequest } from "~/server/appointmentLifecycle/googleOAuthHandlers";

export const Route = createFileRoute("/api/cron/calendar-oauth-smoke")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCalendarOAuthSmokeRequest(request),
    },
  },
});
