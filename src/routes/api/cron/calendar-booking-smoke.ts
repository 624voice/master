import { createFileRoute } from "@tanstack/react-router";
import { handleCalendarBookingSmokeRequest } from "~/server/appointmentLifecycle/calendarBookingSmoke";

export const Route = createFileRoute("/api/cron/calendar-booking-smoke")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCalendarBookingSmokeRequest(request),
    },
  },
});
