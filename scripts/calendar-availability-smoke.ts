#!/usr/bin/env bun
/**
 * Live Google Calendar availability smoke check for 624Voice consultation scheduling.
 *
 * Usage (requires preview/production Google env vars, never commits secrets):
 *   GOOGLE_CALENDAR_ID=info@624voice.com \
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=id-24voice-calendar@voice-search-504400.iam.gserviceaccount.com \
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY='...' \
 *   bun run scripts/calendar-availability-smoke.ts --date 2026-08-24 --part afternoon
 *
 * Optional:
 *   --date YYYY-MM-DD   Central date (default: tomorrow in America/Chicago)
 *   --part morning|afternoon|evening|full_day
 *   --json              Machine-readable output
 */

import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { getGoogleServiceAccountCredentialDiagnostics } from "~/server/appointmentLifecycle/googleCredentials";
import { probeGoogleCalendarProvider } from "~/server/appointmentLifecycle/googleProviderProbe";
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

async function main(): Promise<void> {
  const args = parseArgs();
  const credentialDiagnostics = getGoogleServiceAccountCredentialDiagnostics();

  const rangeInput = { centralDate: args.date, partOfDay: args.partOfDay };
  const resolved = resolveAvailabilityRange(rangeInput, new Date());
  if ("error" in resolved) {
    console.error(resolved.error);
    process.exit(1);
  }

  const result = await probeGoogleCalendarProvider({
    rangeStart: resolved.rangeStart.toISOString(),
    rangeEnd: resolved.rangeEnd.toISOString(),
    maxSlots: 12,
  });

  const payload = {
    ...result,
    timezone: CONSULTATION_TIMEZONE,
    request: {
      centralDate: args.date,
      partOfDay: args.partOfDay,
      windowStart: resolved.rangeStart.toISOString(),
      windowEnd: resolved.rangeEnd.toISOString(),
    },
    credentialDiagnostics,
    finalAvailableSlots: result.availableSlots,
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
