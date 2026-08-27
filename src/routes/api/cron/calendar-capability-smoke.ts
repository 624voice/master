import { createFileRoute } from "@tanstack/react-router";
import { handleCalendarCapabilitySmokeRequest } from "~/server/appointmentLifecycle/calendarCapabilitySmoke";

export const Route = createFileRoute("/api/cron/calendar-capability-smoke")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCalendarCapabilitySmokeRequest(request),
    },
  },
});
