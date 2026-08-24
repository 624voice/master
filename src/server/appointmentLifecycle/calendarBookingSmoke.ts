import {
  compareConsultationBookingVariants,
  describeConsultationInsertPayload,
  probeConsultationBookingCreatePath,
  probeConsultationBookingFullPath,
  probeHandsetEquivalentBookProviderSlot,
  type BookingProviderProbeResult,
} from "~/server/appointmentLifecycle/googleBookingProviderProbe";

export type BookingSmokeMode =
  | "compare"
  | "no_attendee"
  | "with_attendee"
  | "full"
  | "handset"
  | "create_only";

const ALLOWED_MODES = new Set<BookingSmokeMode>([
  "compare",
  "no_attendee",
  "with_attendee",
  "full",
  "handset",
  "create_only",
]);

/** Parse mode query param. Unknown values return null (caller should 400). Omitted defaults to compare. */
export function parseBookingSmokeMode(value: string | null | undefined): BookingSmokeMode | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "compare";
  }
  if (ALLOWED_MODES.has(trimmed as BookingSmokeMode)) {
    return trimmed as BookingSmokeMode;
  }
  return null;
}

export function isCalendarBookingSmokeAuthorized(request: Request): boolean {
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

export function isPreviewDiagnosticContext(): boolean {
  const context = process.env.CONTEXT?.trim();
  if (context === "production") {
    return false;
  }
  return true;
}

function createOnlyMode(mode: BookingSmokeMode): "no_attendee" | "with_attendee" | "full" | "handset" | "compare" {
  if (mode === "create_only") {
    return "no_attendee";
  }
  return mode;
}

export async function handleCalendarBookingSmokeRequest(request: Request): Promise<Response> {
  if (!isPreviewDiagnosticContext()) {
    return new Response(JSON.stringify({ ok: false, error: "Not available in production" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isCalendarBookingSmokeAuthorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start")?.trim() || "2026-08-26T14:00:00.000Z";
  const rawMode = url.searchParams.get("mode");
  const mode = parseBookingSmokeMode(rawMode);
  const attendeeEmail = url.searchParams.get("attendeeEmail")?.trim() || undefined;
  const cleanup = url.searchParams.get("cleanup") !== "false";

  if (mode === null) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid mode",
        allowedModes: [...ALLOWED_MODES],
        receivedMode: rawMode ?? null,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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

  const resolvedMode = createOnlyMode(mode);
  let result: BookingProviderProbeResult;
  if (resolvedMode === "full") {
    result = await probeConsultationBookingFullPath({
      start,
      includeAttendee: true,
      attendeeEmail,
      cleanup,
    });
  } else {
    result = await probeConsultationBookingCreatePath({
      start,
      includeAttendee: resolvedMode === "with_attendee",
      attendeeEmail,
      cleanup,
    });
  }

  const payloadDiff = await describeConsultationInsertPayload({
    start,
    includeAttendee: resolvedMode === "with_attendee" || resolvedMode === "full",
    attendeeEmail,
  });

  return new Response(
    JSON.stringify({
      ok: result.ok,
      mode,
      resolvedMode,
      payloadDiff,
      result,
    }),
    {
      status: result.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    },
  );
}
