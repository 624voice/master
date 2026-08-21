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

function formatNaturalHourMinute(hour12: number, minute: number): string {
  const meridiem = hour12 >= 12 ? "pm" : "am";
  const displayHour = hour12 % 12 === 0 ? 12 : hour12 % 12;
  if (minute === 0) {
    return `${displayHour}${meridiem}`;
  }
  return `${displayHour}:${String(minute).padStart(2, "0")}${meridiem}`;
}

function formatNaturalFromDate(date: Date, timezone: string): {
  time: string;
  timezoneShort: string;
  weekday: string;
  month: string;
  day: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour24 = Number.parseInt(get("hour") || "0", 10);
  const minute = Number.parseInt(get("minute") || "0", 10);

  return {
    weekday: get("weekday"),
    month: get("month"),
    day: get("day"),
    time: formatNaturalHourMinute(hour24, minute),
    timezoneShort: getTimezoneAbbreviation(timezone, date),
  };
}

/** Customer-facing SMS time: 9am, 9:45am, 4:30pm */
export function formatNaturalTime(iso: string, timezone = DEFAULT_TIMEZONE): {
  time: string;
  timezoneShort: string;
} {
  const formatted = formatNaturalFromDate(new Date(iso), timezone);
  return { time: formatted.time, timezoneShort: formatted.timezoneShort };
}

export function formatNaturalAppointmentParts(iso: string, timezone = DEFAULT_TIMEZONE): {
  weekday: string;
  month: string;
  day: string;
  time: string;
  timezoneShort: string;
} {
  return formatNaturalFromDate(new Date(iso), timezone);
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
  return formatNaturalTime(iso, timezone);
}

export function formatTomorrowReference(iso: string, timezone = DEFAULT_TIMEZONE): string {
  const { time, timezoneShort } = formatTimeOnly(iso, timezone);
  return timezoneShort ? `tomorrow at ${time} ${timezoneShort}` : `tomorrow at ${time}`;
}
