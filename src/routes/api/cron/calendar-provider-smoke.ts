import { createFileRoute } from "@tanstack/react-router";
import { probeGoogleCalendarProvider } from "~/server/appointmentLifecycle/googleProviderProbe";
import { resolveAvailabilityRange } from "~/server/speed2Lead/schedulingRange";

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

export const Route = createFileRoute("/api/cron/calendar-provider-smoke")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const date = url.searchParams.get("date") ?? "2026-08-24";
        const part = (url.searchParams.get("part") ?? "morning") as
          | "morning"
          | "afternoon"
          | "evening"
          | "full_day";

        const resolved = resolveAvailabilityRange(
          { centralDate: date, partOfDay: part },
          new Date(),
        );
        if ("error" in resolved) {
          return new Response(JSON.stringify({ ok: false, error: resolved.error }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = await probeGoogleCalendarProvider({
          rangeStart: resolved.rangeStart.toISOString(),
          rangeEnd: resolved.rangeEnd.toISOString(),
          maxSlots: 12,
        });

        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 502,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
