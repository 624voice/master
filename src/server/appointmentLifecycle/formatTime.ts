import { DEFAULT_TIMEZONE } from "~/server/appointmentLifecycle/config";

const ZONE_ABBREVIATIONS: Record<string, string> = {
  "America/Chicago": "CT",
  "America/New_York": "ET",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Phoenix": "MST",
};

export function getTimezoneAbbreviation(timezone: string, date: Date): string {
  if (ZONE_ABBREVIATIONS[timezone]) {
    return ZONE_ABBREVIATIONS[timezone]!;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tz && !tz.startsWith("GMT")) {
      return tz;
    }
  } catch {
    // fall through
  }

  return "";
}

export function formatAppointmentParts(iso: string, timezone = DEFAULT_TIMEZONE): {
  weekday: string;
  month: string;
  day: string;
  time: string;
  timezoneShort: string;
} {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(date);
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const timezoneShort = getTimezoneAbbreviation(timezone, date);

  return { weekday, month, day, time, timezoneShort };
}

export function formatTimeOnly(iso: string, timezone = DEFAULT_TIMEZONE): {
  time: string;
  timezoneShort: string;
} {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return { time, timezoneShort: getTimezoneAbbreviation(timezone, date) };
}

export function formatTomorrowReference(iso: string, timezone = DEFAULT_TIMEZONE): string {
  const { time, timezoneShort } = formatTimeOnly(iso, timezone);
  return timezoneShort ? `tomorrow at ${time} ${timezoneShort}` : `tomorrow at ${time}`;
}
