import { describe, expect, test } from "bun:test";
import {
  CONSULTATION_SLOT_INTERVAL_MINUTES,
  CONSULTATION_TIMEZONE,
  getConsultationBufferMinutes,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildBusyIntervalsFromEvents,
  centralDateAt,
  expandBusyIntervals,
  filterAvailableConsultationSlots,
  generateConsultationCandidateStarts,
  isSlotAvailable,
  selectConsultationSlots,
} from "~/server/appointmentLifecycle/consultationSlots";

const TZ = CONSULTATION_TIMEZONE;
const DURATION = getConsultationDurationMinutes();
const BUFFER = getConsultationBufferMinutes();

function wednesdayRange(hourStart: number, hourEnd: number) {
  return {
    rangeStart: centralDateAt(2026, 8, 19, hourStart, 0, TZ),
    rangeEnd: centralDateAt(2026, 8, 19, hourEnd, 0, TZ),
  };
}

describe("consultationSlots deterministic availability", () => {
  test("busy calendar events remove conflicting slots", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 17);
    const now = centralDateAt(2026, 8, 19, 8, 0, TZ);
    const busyStart = centralDateAt(2026, 8, 19, 10, 0, TZ);
    const busyEnd = centralDateAt(2026, 8, 19, 10, 30, TZ);

    const slots = selectConsultationSlots({ rangeStart, rangeEnd, now }, [
      { startMs: busyStart.getTime(), endMs: busyEnd.getTime() },
    ]);

    expect(slots).not.toContain(busyStart.toISOString());
    expect(slots).not.toContain(centralDateAt(2026, 8, 19, 10, 15, TZ).toISOString());
    expect(slots).toContain(centralDateAt(2026, 8, 19, 10, 45, TZ).toISOString());
  });

  test("10-minute meeting buffers are respected", () => {
    const availableStart = centralDateAt(2026, 8, 19, 11, 45, TZ);
    const busy = [
      {
        startMs: centralDateAt(2026, 8, 19, 11, 0, TZ).getTime(),
        endMs: centralDateAt(2026, 8, 19, 11, 30, TZ).getTime(),
      },
    ];
    const expanded = expandBusyIntervals(busy, BUFFER);

    expect(
      isSlotAvailable(
        centralDateAt(2026, 8, 19, 10, 30, TZ).getTime(),
        DURATION,
        expanded,
      ),
    ).toBe(false);
    expect(isSlotAvailable(availableStart.getTime(), DURATION, expanded)).toBe(true);
  });

  test("25-minute consultation duration is respected", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 17);
    const now = centralDateAt(2026, 8, 19, 8, 0, TZ);
    const slots = generateConsultationCandidateStarts({ rangeStart, rangeEnd, now });

    const lastSlot = slots[slots.length - 1]!;
    const lastStartMs = new Date(lastSlot).getTime();
    const dayEndMs = centralDateAt(2026, 8, 19, 17, 0, TZ).getTime();

    expect(lastStartMs + DURATION * 60_000).toBeLessThanOrEqual(dayEndMs);
    expect(lastSlot).toBe(centralDateAt(2026, 8, 19, 16, 30, TZ).toISOString());
  });

  test("slots are limited to configured business hours", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 17);
    const now = centralDateAt(2026, 8, 19, 8, 0, TZ);
    const slots = generateConsultationCandidateStarts({ rangeStart, rangeEnd, now });

    expect(slots[0]).toBe(centralDateAt(2026, 8, 19, 9, 0, TZ).toISOString());
    for (const slot of slots) {
      const ms = new Date(slot).getTime();
      expect(ms).toBeGreaterThanOrEqual(centralDateAt(2026, 8, 19, 9, 0, TZ).getTime());
      expect(ms + DURATION * 60_000).toBeLessThanOrEqual(
        centralDateAt(2026, 8, 19, 17, 0, TZ).getTime(),
      );
    }
  });

  test("weekends are excluded", () => {
    const rangeStart = centralDateAt(2026, 8, 22, 0, 0, TZ);
    const rangeEnd = centralDateAt(2026, 8, 22, 23, 59, TZ);
    const now = centralDateAt(2026, 8, 22, 8, 0, TZ);

    const slots = generateConsultationCandidateStarts({ rangeStart, rangeEnd, now });
    expect(slots).toEqual([]);
  });

  test("past times are excluded", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 17);
    const now = centralDateAt(2026, 8, 19, 14, 0, TZ);
    const slots = generateConsultationCandidateStarts({ rangeStart, rangeEnd, now });

    expect(slots.every((slot) => new Date(slot).getTime() > now.getTime())).toBe(true);
    expect(slots[0]).toBe(centralDateAt(2026, 8, 19, 14, 15, TZ).toISOString());
  });

  test("returned slots are ordered chronologically", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 17);
    const now = centralDateAt(2026, 8, 19, 8, 0, TZ);
    const busy = buildBusyIntervalsFromEvents([
      {
        appointmentStart: centralDateAt(2026, 8, 19, 11, 0, TZ).toISOString(),
        appointmentEnd: centralDateAt(2026, 8, 19, 11, 30, TZ).toISOString(),
      },
    ]);

    const slots = selectConsultationSlots({ rangeStart, rangeEnd, now }, busy);
    const times = slots.map((slot) => new Date(slot).getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((time, index) => index === 0 || time > times[index - 1]!)).toBe(true);
  });

  test("cancelled events do not block availability", () => {
    const candidates = [
      centralDateAt(2026, 8, 19, 10, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 19, 10, 15, TZ).toISOString(),
    ];
    const busy = buildBusyIntervalsFromEvents([
      {
        appointmentStart: centralDateAt(2026, 8, 19, 10, 0, TZ).toISOString(),
        appointmentEnd: centralDateAt(2026, 8, 19, 10, 30, TZ).toISOString(),
        status: "cancelled",
      },
    ]);

    expect(filterAvailableConsultationSlots(candidates, busy)).toEqual(candidates);
  });

  test("candidate slots use 15-minute intervals", () => {
    const { rangeStart, rangeEnd } = wednesdayRange(9, 12);
    const now = centralDateAt(2026, 8, 19, 8, 0, TZ);
    const slots = generateConsultationCandidateStarts({ rangeStart, rangeEnd, now });

    expect(slots.slice(0, 4)).toEqual([
      centralDateAt(2026, 8, 19, 9, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 19, 9, 15, TZ).toISOString(),
      centralDateAt(2026, 8, 19, 9, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 19, 9, 45, TZ).toISOString(),
    ]);
    expect(CONSULTATION_SLOT_INTERVAL_MINUTES).toBe(15);
  });
});
