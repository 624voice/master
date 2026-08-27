import { probeGoogleCalendarCapability } from "~/server/appointmentLifecycle/calendarCapabilityProbe";
import {
  isCalendarBookingSmokeAuthorized,
  isPreviewDiagnosticContext,
} from "~/server/appointmentLifecycle/calendarBookingSmoke";

export async function handleCalendarCapabilitySmokeRequest(request: Request): Promise<Response> {
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

  const result = await probeGoogleCalendarCapability();

  return new Response(JSON.stringify(result), {
    status: result.configurationError ? 503 : result.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}
