#!/usr/bin/env bun
/**
 * Live Google Calendar booking smoke check for 624Voice consultation scheduling.
 *
 * Exercises the same provider path as SMS booking:
 * recheck slot → createConsultationEvent → events.insert
 *
 * Usage (requires preview/production Google env vars, never commits secrets):
 *   CRON_SECRET=... bun run scripts/calendar-booking-smoke.ts --start 2026-08-26T14:00:00.000Z --mode compare
 *
 * Optional:
 *   --start ISO8601 start (default: 2026-08-26T14:00:00.000Z)
 *   --mode compare|no_attendee|with_attendee|full
 *   --attendee-email email@example.com
 *   --no-cleanup         Leave diagnostic events on calendar
 *   --preview-url URL    Hit deploy preview endpoint instead of local provider code
 *   --json               Machine-readable output (default)
 */

import {
  compareConsultationBookingVariants,
  describeConsultationInsertPayload,
  probeConsultationBookingCreatePath,
  probeConsultationBookingFullPath,
  probeHandsetEquivalentBookProviderSlot,
} from "~/server/appointmentLifecycle/googleBookingProviderProbe";

type Args = {
  start: string;
  mode: "compare" | "no_attendee" | "with_attendee" | "full" | "handset" | "create_only";
  attendeeEmail?: string;
  cleanup: boolean;
  previewUrl?: string;
  cronSecret?: string;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let start = "2026-08-26T14:00:00.000Z";
  let mode: Args["mode"] = "compare";
  let attendeeEmail: string | undefined;
  let cleanup = true;
  let previewUrl: string | undefined;
  let cronSecret = process.env.CRON_SECRET;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--start" && argv[i + 1]) {
      start = argv[++i]!;
    } else if (arg === "--mode" && argv[i + 1]) {
      mode = argv[++i] as Args["mode"];
    } else if (arg === "--attendee-email" && argv[i + 1]) {
      attendeeEmail = argv[++i];
    } else if (arg === "--no-cleanup") {
      cleanup = false;
    } else if (arg === "--preview-url" && argv[i + 1]) {
      previewUrl = argv[++i];
    } else if (arg === "--cron-secret" && argv[i + 1]) {
      cronSecret = argv[++i];
    }
  }

  return { start, mode, attendeeEmail, cleanup, previewUrl, cronSecret };
}

async function runPreviewEndpoint(args: Args): Promise<unknown> {
  if (!args.previewUrl) {
    throw new Error("--preview-url is required for remote smoke");
  }
  if (!args.cronSecret) {
    throw new Error("CRON_SECRET is required for remote smoke");
  }

  const url = new URL("/api/cron/calendar-booking-smoke", args.previewUrl);
  url.searchParams.set("start", args.start);
  url.searchParams.set("mode", args.mode);
  if (args.attendeeEmail) {
    url.searchParams.set("attendeeEmail", args.attendeeEmail);
  }
  if (!args.cleanup) {
    url.searchParams.set("cleanup", "false");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${args.cronSecret}`,
    },
  });

  const body = (await response.json()) as unknown;
  return { httpStatus: response.status, body };
}

async function runLocal(args: Args): Promise<unknown> {
  if (args.mode === "handset") {
    return probeHandsetEquivalentBookProviderSlot({
      start: args.start,
      cleanup: args.cleanup,
    });
  }

  if (args.mode === "compare") {
    const comparison = await compareConsultationBookingVariants({
      start: args.start,
      attendeeEmail: args.attendeeEmail,
      cleanup: args.cleanup,
    });
    return {
      ok: comparison.withoutAttendee.ok && comparison.withAttendee.ok,
      mode: args.mode,
      payloadDiff: {
        withoutAttendee: await describeConsultationInsertPayload({
          start: args.start,
          includeAttendee: false,
        }),
        withAttendee: await describeConsultationInsertPayload({
          start: args.start,
          includeAttendee: true,
          attendeeEmail: args.attendeeEmail,
        }),
      },
      ...comparison,
    };
  }

  if (args.mode === "full") {
    const result = await probeConsultationBookingFullPath({
      start: args.start,
      includeAttendee: true,
      attendeeEmail: args.attendeeEmail,
      cleanup: args.cleanup,
    });
    return {
      ok: result.ok,
      mode: args.mode,
      payloadDiff: await describeConsultationInsertPayload({
        start: args.start,
        includeAttendee: true,
        attendeeEmail: args.attendeeEmail,
      }),
      result,
    };
  }

  const result = await probeConsultationBookingCreatePath({
    start: args.start,
    includeAttendee: args.mode === "with_attendee",
    attendeeEmail: args.attendeeEmail,
    cleanup: args.cleanup,
  });

  return {
    ok: result.ok,
    mode: args.mode,
    payloadDiff: await describeConsultationInsertPayload({
      start: args.start,
      includeAttendee: args.mode === "with_attendee",
      attendeeEmail: args.attendeeEmail,
    }),
    result,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const payload = args.previewUrl ? await runPreviewEndpoint(args) : await runLocal(args);
  console.log(JSON.stringify(payload, null, 2));

  const ok =
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    Boolean((payload as { ok?: boolean }).ok);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
