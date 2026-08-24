import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  handleCalendarBookingSmokeRequest,
  parseBookingSmokeMode,
} from "~/server/appointmentLifecycle/calendarBookingSmoke";

const probeCreatePath = mock(async () => ({
  ok: true,
  mode: "create_only" as const,
  variant: "no_attendee" as const,
  startIso: "2026-08-26T14:00:00.000Z",
  durationMinutes: 25,
  calendarId: "test@calendar",
  recheckAttempted: true,
  recheckSucceeded: true,
  createAttempted: true,
  eventCreated: true,
  eventIdPresent: true,
  attendeeIncluded: false,
  attendeeCount: 0,
  diagnosticEventLabel: "test",
  credentialDiagnostics: {} as never,
}));

const probeCompare = mock(async () => ({
  startIso: "2026-08-26T14:00:00.000Z",
  calendarId: "test@calendar",
  withoutAttendee: { ok: true, variant: "no_attendee" as const },
  withAttendee: { ok: true, variant: "with_attendee" as const },
}));

const probeHandset = mock(async () => ({
  ok: true,
  mode: "handset_book_provider_slot" as const,
  entrypoint: "bookProviderSlot" as const,
  startIso: "2026-08-26T14:00:00.000Z",
  phoneSuffix: "8991",
  attendeeIncluded: true,
  attendeeCount: 1,
  bookingResult: { ok: true, eventId: "evt-1", selectedStart: "2026-08-26T14:00:00.000Z" },
  smokePathComparison: {
    smokeUses: "createConsultationEvent",
    handsetUses: "bookProviderSlot → bookConsultation → createConsultationEvent → processCalendarEvent",
    inputDiff: [],
  },
}));

const describePayload = mock(async () => ({
  attendeeIncluded: false,
  attendeeCount: 0,
  summaryPrefix: "624Voice AI Consultation - Test",
  hasAttendeesField: false,
}));

mock.module("~/server/appointmentLifecycle/googleBookingProviderProbe", () => ({
  compareConsultationBookingVariants: probeCompare,
  describeConsultationInsertPayload: describePayload,
  probeConsultationBookingCreatePath: probeCreatePath,
  probeConsultationBookingFullPath: probeCreatePath,
  probeHandsetEquivalentBookProviderSlot: probeHandset,
}));

describe("parseBookingSmokeMode", () => {
  test("accepts handset mode", () => {
    expect(parseBookingSmokeMode("handset")).toBe("handset");
  });

  test("accepts create_only mode", () => {
    expect(parseBookingSmokeMode("create_only")).toBe("create_only");
  });

  test("defaults omitted mode to compare", () => {
    expect(parseBookingSmokeMode(null)).toBe("compare");
    expect(parseBookingSmokeMode(undefined)).toBe("compare");
    expect(parseBookingSmokeMode("")).toBe("compare");
  });

  test("returns null for unknown mode", () => {
    expect(parseBookingSmokeMode("bogus")).toBeNull();
    expect(parseBookingSmokeMode("handsetx")).toBeNull();
  });
});

describe("handleCalendarBookingSmokeRequest mode routing", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalContext = process.env.CONTEXT;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.CONTEXT = "deploy-preview";
    process.env.NODE_ENV = "production";
    probeCreatePath.mockClear();
    probeCompare.mockClear();
    probeHandset.mockClear();
    describePayload.mockClear();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.CONTEXT = originalContext;
    process.env.NODE_ENV = originalNodeEnv;
  });

  function request(mode: string): Request {
    return new Request(
      `https://deploy-preview-61--624voice.netlify.app/api/cron/calendar-booking-smoke?mode=${encodeURIComponent(mode)}&start=2026-08-26T14:00:00.000Z`,
      {
        headers: { Authorization: "Bearer test-cron-secret" },
      },
    );
  }

  test("mode=compare invokes compare diagnostic", async () => {
    const response = await handleCalendarBookingSmokeRequest(request("compare"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode?: string; withoutAttendee?: unknown };
    expect(body.mode).toBe("compare");
    expect(body.withoutAttendee).toBeDefined();
    expect(probeCompare).toHaveBeenCalledTimes(1);
    expect(probeHandset).toHaveBeenCalledTimes(0);
  });

  test("mode=handset invokes handset bookProviderSlot diagnostic", async () => {
    const response = await handleCalendarBookingSmokeRequest(request("handset"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode?: string; entrypoint?: string };
    expect(body.mode).toBe("handset_book_provider_slot");
    expect(body.entrypoint).toBe("bookProviderSlot");
    expect(probeHandset).toHaveBeenCalledTimes(1);
    expect(probeCompare).toHaveBeenCalledTimes(0);
  });

  test("mode=create_only invokes create-only diagnostic", async () => {
    const response = await handleCalendarBookingSmokeRequest(request("create_only"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode?: string; resolvedMode?: string };
    expect(body.mode).toBe("create_only");
    expect(body.resolvedMode).toBe("no_attendee");
    expect(probeCreatePath).toHaveBeenCalledTimes(1);
    expect(probeHandset).toHaveBeenCalledTimes(0);
  });

  test("unknown mode returns 400 without compare fallback", async () => {
    const response = await handleCalendarBookingSmokeRequest(request("not-a-real-mode"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string; receivedMode?: string };
    expect(body.error).toBe("Invalid mode");
    expect(body.receivedMode).toBe("not-a-real-mode");
    expect(probeCompare).toHaveBeenCalledTimes(0);
    expect(probeHandset).toHaveBeenCalledTimes(0);
    expect(probeCreatePath).toHaveBeenCalledTimes(0);
  });
});
