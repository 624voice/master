import {
  CONSULTATION_SLOT_INTERVAL_MINUTES,
  CONSULTATION_TIMEZONE,
  getConsultationBufferMinutes,
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
  type ConsultationBusinessHours,
} from "~/server/appointmentLifecycle/consultationConfig";

export type BusyInterval = {
  startMs: number;
  endMs: number;
};

export type GenerateConsultationSlotsInput = {
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
  maxSlots?: number;
  durationMinutes?: number;
  bufferMinutes?: number;
  slotIntervalMinutes?: number;
  businessHours?: ConsultationBusinessHours;
  timezone?: string;
};

type CentralParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
};

function parseCentralParts(date: Date, timezone: string): CentralParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function centralDateAt(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
  const observed = parseCentralParts(guess, timezone);
  const deltaHours = hour - observed.hour;
  const deltaMinutes = minute - observed.minute;
  return new Date(guess.getTime() + deltaHours * 3_600_000 + deltaMinutes * 60_000);
}

function isWeekendWeekday(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function expandBusyIntervals(
  intervals: BusyInterval[],
  bufferMinutes: number,
): BusyInterval[] {
  const bufferMs = bufferMinutes * 60_000;
  return intervals.map((interval) => ({
    startMs: interval.startMs - bufferMs,
    endMs: interval.endMs + bufferMs,
  }));
}

export function isSlotAvailable(
  slotStartMs: number,
  durationMinutes: number,
  busyIntervals: BusyInterval[],
): boolean {
  const slotEndMs = slotStartMs + durationMinutes * 60_000;
  return !busyIntervals.some((busy) =>
    overlaps(slotStartMs, slotEndMs, busy.startMs, busy.endMs),
  );
}

export function generateConsultationCandidateStarts(
  input: GenerateConsultationSlotsInput,
): string[] {
  const timezone = input.timezone ?? CONSULTATION_TIMEZONE;
  const durationMinutes = input.durationMinutes ?? getConsultationDurationMinutes();
  const businessHours = input.businessHours ?? getConsultationBusinessHours();
  const slotIntervalMinutes = input.slotIntervalMinutes ?? CONSULTATION_SLOT_INTERVAL_MINUTES;
  const now = input.now ?? new Date();
  const maxSlots = input.maxSlots ?? Number.POSITIVE_INFINITY;

  const candidates: string[] = [];
  const rangeStartParts = parseCentralParts(input.rangeStart, timezone);
  const rangeEndParts = parseCentralParts(input.rangeEnd, timezone);

  let year = rangeStartParts.year;
  let month = rangeStartParts.month;
  let day = rangeStartParts.day;

  const lastCentralDayMs = centralDateAt(
    rangeEndParts.year,
    rangeEndParts.month,
    rangeEndParts.day,
    23,
    59,
    timezone,
  ).getTime();

  while (candidates.length < maxSlots) {
    const dayAnchor = centralDateAt(year, month, day, 12, 0, timezone);
    if (dayAnchor.getTime() > lastCentralDayMs) {
      break;
    }

    const { weekday } = parseCentralParts(dayAnchor, timezone);
    if (!isWeekendWeekday(weekday)) {
      const dayStart = centralDateAt(
        year,
        month,
        day,
        businessHours.weekdayStartHour,
        businessHours.weekdayStartMinute,
        timezone,
      );
      const dayEnd = centralDateAt(
        year,
        month,
        day,
        businessHours.weekdayEndHour,
        businessHours.weekdayEndMinute,
        timezone,
      );
      const lastStartMs = dayEnd.getTime() - durationMinutes * 60_000;

      for (
        let slotMs = dayStart.getTime();
        slotMs <= lastStartMs;
        slotMs += slotIntervalMinutes * 60_000
      ) {
        if (slotMs < input.rangeStart.getTime() || slotMs > input.rangeEnd.getTime()) {
          continue;
        }
        if (slotMs <= now.getTime()) {
          continue;
        }
        candidates.push(new Date(slotMs).toISOString());
        if (candidates.length >= maxSlots) {
          break;
        }
      }
    }

    const nextDay = centralDateAt(year, month, day, 12, 0, timezone);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextParts = parseCentralParts(nextDay, timezone);
    year = nextParts.year;
    month = nextParts.month;
    day = nextParts.day;
  }

  return candidates;
}

export function filterAvailableConsultationSlots(
  candidateStarts: string[],
  busyIntervals: BusyInterval[],
  durationMinutes = getConsultationDurationMinutes(),
  bufferMinutes = getConsultationBufferMinutes(),
): string[] {
  const expandedBusy = expandBusyIntervals(busyIntervals, bufferMinutes);
  return candidateStarts.filter((start) =>
    isSlotAvailable(new Date(start).getTime(), durationMinutes, expandedBusy),
  );
}

export function selectConsultationSlots(
  input: GenerateConsultationSlotsInput,
  busyIntervals: BusyInterval[],
): string[] {
  const durationMinutes = input.durationMinutes ?? getConsultationDurationMinutes();
  const bufferMinutes = input.bufferMinutes ?? getConsultationBufferMinutes();
  const candidates = generateConsultationCandidateStarts(input);
  return filterAvailableConsultationSlots(
    candidates,
    busyIntervals,
    durationMinutes,
    bufferMinutes,
  );
}

export function buildBusyIntervalsFromEvents(
  events: Array<{ appointmentStart: string; appointmentEnd: string; status?: string }>,
): BusyInterval[] {
  return events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      startMs: new Date(event.appointmentStart).getTime(),
      endMs: new Date(event.appointmentEnd).getTime(),
    }));
}

export { parseCentralParts, centralDateAt, isWeekendWeekday };
