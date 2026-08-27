import type { AvailabilityRangeInput } from "~/server/speed2Lead/schedulingRange";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

/** Provider-neutral scheduling context passed to availability adapters. */
export type SchedulingAvailabilityContext = {
  session: AnyConversationContext;
  range: AvailabilityRangeInput;
  maxSlots: number;
  now: Date;
};

export type AvailabilityResult =
  | { ok: true; slots: string[] }
  | { ok: false; reason: string; calendarUnavailable?: boolean };

export type BookingCustomer = {
  phone: string;
  name: string;
  email?: string;
  source: "roi" | "contact" | "demo";
};

export type BookingResult =
  | { ok: true; eventId: string; selectedStart: string; replayed: boolean }
  | { ok: false; reason: string };

/**
 * Mature provider-neutral contracts for future shared scheduling core.
 * Current production path uses Google Calendar + bookConsultation directly;
 * Cal.com and other adapters can implement these without changing gate logic.
 */
export interface SchedulingProviderAdapter {
  getAvailability(context: SchedulingAvailabilityContext): Promise<AvailabilityResult>;
  bookAppointment(slotStart: string, customer: BookingCustomer): Promise<BookingResult>;
  cancelAppointment?(eventId: string): Promise<boolean>;
  rescheduleAppointment?(eventId: string, slotStart: string): Promise<BookingResult>;
}
