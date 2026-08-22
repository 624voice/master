#!/usr/bin/env bun
/**
 * Live Google Calendar availability smoke check for 624Voice consultation scheduling.
 *
 * Usage (requires preview/production Google env vars, never commits secrets):
 *   GOOGLE_CALENDAR_ID=... \
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY='...' \
 *   bun run scripts/calendar-availability-smoke.ts --date 2026-08-24 --part afternoon
 *
 * Optional:
 *   --date YYYY-MM-DD   Central date (default: tomorrow in America/Chicago)
 *   --part morning|afternoon|evening|full_day
 *   --json              Machine-readable output
 */

import {
  CONSULTATION_TIMEZONE,
  getConsultationBusinessHours,
} from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBusyIntervalsFromEvents,
  generateConsultationCandidateStarts,
} from "~/server/appointmentLifecycle/consultationSlots";
import {
  getGoogleCalendarId,
  isGoogleCalendarApiConfigured,
} from "~/server/appointmentLifecycle/config";
import {
  fetchCalendarEventsInRange,
  getConsultationSlots,
} from "~/server/appointmentLifecycle/googleCalendar";
import { resolveAvailabilityRange } from "~/server/speed2Lead/schedulingRange";

type Args = {
  date: string;
  partOfDay: "morning" | "afternoon" | "evening" | "full_day";
  json: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let date = "";
  let partOfDay: Args["partOfDay"] = "full_day";
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date" && argv[i + 1]) {
      date = argv[++i]!;
    } else if (arg === "--part" && argv[i + 1]) {
      partOfDay = argv[++i] as Args["partOfDay"];
    } else if (arg === "--json") {
      json = true;
    }
  }

  if (!date) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CONSULTATION_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(tomorrow);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    date = `${get("year")}-${get("month")}-${get("day")}`;
  }

  return { date, partOfDay, json };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local?.slice(0, 3) ?? ""}***@${domain}`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const configured = isGoogleCalendarApiConfigured();
  const calendarId = getGoogleCalendarId() ?? null;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;

  if (!configured || !calendarId || !serviceAccountEmail) {
    const payload = {
      ok: false,
      providerStatus: "not_configured",
      calendarId,
      serviceAccountEmail: serviceAccountEmail ? maskEmail(serviceAccountEmail) : null,
      timezone: CONSULTATION_TIMEZONE,
      message: "Missing GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    };
    console.log(args.json ? JSON.stringify(payload, null, 2) : payload.message);
    process.exit(1);
  }

  const rangeInput = { centralDate: args.date, partOfDay: args.partOfDay };
  const resolved = resolveAvailabilityRange(rangeInput, new Date());
  if ("error" in resolved) {
    console.error(resolved.error);
    process.exit(1);
  }

  let eventsFetchError: string | null = null;
  let eventsFetchResult: Awaited<ReturnType<typeof fetchCalendarEventsInRange>> = {
    ok: false,
    reason: "not_configured",
  };
  try {
    eventsFetchResult = await fetchCalendarEventsInRange(
      resolved.rangeStart.toISOString(),
      resolved.rangeEnd.toISOString(),
    );
    if (!eventsFetchResult.ok) {
      eventsFetchError = eventsFetchResult.detail ?? eventsFetchResult.reason;
    }
  } catch (error) {
    eventsFetchError = error instanceof Error ? error.message : String(error);
  }

  const events = eventsFetchResult.ok ? eventsFetchResult.events : [];
  const busy = buildBusyIntervalsFromEvents(events);
  const candidates = generateConsultationCandidateStarts({
    rangeStart: resolved.rangeStart,
    rangeEnd: resolved.rangeEnd,
    maxSlots: Number.POSITIVE_INFINITY,
  });

  const availability = await getConsultationSlots({
    rangeStart: resolved.rangeStart,
    rangeEnd: resolved.rangeEnd,
    maxSlots: 12,
    now: new Date(),
  });

  const payload = {
    ok: availability.ok,
    providerStatus: availability.ok ? "ok" : availability.reason,
    providerDetail: availability.ok ? undefined : availability.detail,
    eventsFetchError,
    calendarId,
    serviceAccountEmail: maskEmail(serviceAccountEmail),
    timezone: CONSULTATION_TIMEZONE,
    businessHours: getConsultationBusinessHours(),
    request: {
      centralDate: args.date,
      partOfDay: args.partOfDay,
      windowStart: resolved.rangeStart.toISOString(),
      windowEnd: resolved.rangeEnd.toISOString(),
    },
    rawEventCount: events.length,
    busyIntervals: busy.map((b) => ({
      start: new Date(b.startMs).toISOString(),
      end: new Date(b.endMs).toISOString(),
    })),
    candidateSlotCount: candidates.length,
    candidateSlotsSample: candidates.slice(0, 12),
    finalAvailableSlots: availability.ok ? availability.slots : [],
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }

  process.exit(availability.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
