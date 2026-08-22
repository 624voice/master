import { DEFAULT_TIMEZONE } from "~/server/appointmentLifecycle/config";

export const CONSULTATION_TIMEZONE = DEFAULT_TIMEZONE;
export const CONSULTATION_DURATION_MINUTES = 25;
export const CONSULTATION_BUFFER_MINUTES = 10;
export const CONSULTATION_SLOT_INTERVAL_MINUTES = 15;

export type ConsultationBusinessHours = {
  weekdayStartHour: number;
  weekdayStartMinute: number;
  weekdayEndHour: number;
  weekdayEndMinute: number;
};

export const DEFAULT_CONSULTATION_BUSINESS_HOURS: ConsultationBusinessHours = {
  weekdayStartHour: 9,
  weekdayStartMinute: 0,
  weekdayEndHour: 17,
  weekdayEndMinute: 0,
};

export function getConsultationDurationMinutes(): number {
  const parsed = Number(process.env.S2L_CONSULTATION_MINUTES);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : CONSULTATION_DURATION_MINUTES;
}

export function getConsultationBufferMinutes(): number {
  const parsed = Number(process.env.S2L_CONSULTATION_BUFFER_MINUTES);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : CONSULTATION_BUFFER_MINUTES;
}

export function getConsultationBusinessHours(): ConsultationBusinessHours {
  const raw = process.env.S2L_CONSULTATION_BUSINESS_HOURS_JSON;
  if (!raw) {
    return DEFAULT_CONSULTATION_BUSINESS_HOURS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ConsultationBusinessHours>;
    return {
      weekdayStartHour: parsed.weekdayStartHour ?? DEFAULT_CONSULTATION_BUSINESS_HOURS.weekdayStartHour,
      weekdayStartMinute:
        parsed.weekdayStartMinute ?? DEFAULT_CONSULTATION_BUSINESS_HOURS.weekdayStartMinute,
      weekdayEndHour: parsed.weekdayEndHour ?? DEFAULT_CONSULTATION_BUSINESS_HOURS.weekdayEndHour,
      weekdayEndMinute:
        parsed.weekdayEndMinute ?? DEFAULT_CONSULTATION_BUSINESS_HOURS.weekdayEndMinute,
    };
  } catch {
    return DEFAULT_CONSULTATION_BUSINESS_HOURS;
  }
}

export function consultationBlockMinutes(
  durationMinutes = getConsultationDurationMinutes(),
  bufferMinutes = getConsultationBufferMinutes(),
): number {
  return durationMinutes + bufferMinutes * 2;
}
