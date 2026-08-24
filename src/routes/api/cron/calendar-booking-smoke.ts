import { createFileRoute } from "@tanstack/react-router";
import {
  compareConsultationBookingVariants,
  describeConsultationInsertPayload,
  probeConsultationBookingCreatePath,
  probeConsultationBookingFullPath,
  probeHandsetEquivalentBookProviderSlot,
  type BookingProviderProbeResult,
} from "~/server/appointmentLifecycle/googleBookingProviderProbe";

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

/** Block production deploy context — preview/local diagnostics only. */
function isPreviewDiagnosticContext(): boolean {
  const context = process.env.CONTEXT?.trim();
  if (context === "production") {
    return false;
  }
  return true;
}

type BookingSmokeMode =
  | "compare"
  | "no_attendee"
  | "with_attendee"
  | "full"
  | "handset";

function parseMode(value: string | null): BookingSmokeMode {
  if (
    value === "compare" ||
    value === "no_attendee" ||
    value === "with_attendee" ||
    value === "full" ||
    value === "handset"
  ) {
    return value;
  }
  return "compare";
}

export const Route = createFileRoute("/api/cron/calendar-booking-smoke")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isPreviewDiagnosticContext()) {
          return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const start =
          url.searchParams.get("start")?.trim() || "2026-08-26T14:00:00.000Z";
        const mode = parseMode(url.searchParams.get("mode"));
        const attendeeEmail = url.searchParams.get("attendeeEmail")?.trim() || undefined;
        const cleanup = url.searchParams.get("cleanup") !== "false";

        if (Number.isNaN(new Date(start).getTime())) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid start ISO" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (mode === "handset") {
          const handset = await probeHandsetEquivalentBookProviderSlot({
            start,
            cleanup,
          });
          return new Response(JSON.stringify(handset), {
            status: handset.ok ? 200 : 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (mode === "compare") {
          const comparison = await compareConsultationBookingVariants({
            start,
            attendeeEmail,
            cleanup,
          });
          const payloadDiff = {
            withoutAttendee: await describeConsultationInsertPayload({
              start,
              includeAttendee: false,
            }),
            withAttendee: await describeConsultationInsertPayload({
              start,
              includeAttendee: true,
              attendeeEmail,
            }),
          };

          const ok =
            comparison.withoutAttendee.ok || comparison.withAttendee.ok
              ? comparison.withoutAttendee.ok && comparison.withAttendee.ok
              : false;

          return new Response(
            JSON.stringify({
              ok,
              mode,
              startIso: start,
              payloadDiff,
              ...comparison,
            }),
            {
              status: ok ? 200 : 502,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        let result: BookingProviderProbeResult;
        if (mode === "full") {
          result = await probeConsultationBookingFullPath({
            start,
            includeAttendee: true,
            attendeeEmail,
            cleanup,
          });
        } else {
          result = await probeConsultationBookingCreatePath({
            start,
            includeAttendee: mode === "with_attendee",
            attendeeEmail,
            cleanup,
          });
        }

        const payloadDiff = await describeConsultationInsertPayload({
          start,
          includeAttendee: mode === "with_attendee" || mode === "full",
          attendeeEmail,
        });

        return new Response(JSON.stringify({ ok: result.ok, mode, payloadDiff, result }), {
          status: result.ok ? 200 : 502,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
