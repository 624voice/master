import { getConsultationSlots } from "~/server/appointmentLifecycle/googleCalendar";
import { bookConsultation } from "~/server/appointmentLifecycle/bookConsultation";
import type { BookingCustomer } from "~/server/scheduling/types";

export type ProviderAvailabilityResult =
  | {
      ok: true;
      slots: string[];
      queryStartIso: string;
      queryEndIso: string;
      rawEventCount?: number;
    }
  | { ok: false; reason: string; queryStartIso: string; queryEndIso: string };

export async function queryProviderAvailability(args: {
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
  maxSlots?: number;
}): Promise<ProviderAvailabilityResult> {
  const queryStartIso = args.rangeStart.toISOString();
  const queryEndIso = args.rangeEnd.toISOString();
  const result = await getConsultationSlots({
    rangeStart: args.rangeStart,
    rangeEnd: args.rangeEnd,
    maxSlots: args.maxSlots ?? 48,
    now: args.now,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      queryStartIso,
      queryEndIso,
    };
  }

  return {
    ok: true,
    slots: result.slots,
    queryStartIso,
    queryEndIso,
  };
}

export type ProviderBookingResult =
  | { ok: true; eventId: string; selectedStart: string; lifecycleConfirmationSent?: boolean }
  | { ok: false; reason: string; failureType: "provider_conflict" | "provider_error" | "invalid_selection" };

export async function bookProviderSlot(args: {
  start: string;
  customer: BookingCustomer;
  now: Date;
}): Promise<ProviderBookingResult> {
  const booked = await bookConsultation({
    start: args.start,
    attendeeName: args.customer.name,
    attendeeEmail: args.customer.email,
    phone: args.customer.phone,
    businessName: args.customer.businessName,
    source: args.customer.source,
    notes: args.customer.notes,
    now: args.now,
  });

  if (!booked.ok) {
    return {
      ok: false,
      reason: booked.reason,
      failureType:
        booked.reason === "slot_unavailable" ? "provider_conflict" : "provider_error",
    };
  }

  if (!booked.eventId) {
    return { ok: false, reason: "missing_event_id", failureType: "provider_error" };
  }

  return {
    ok: true,
    eventId: booked.eventId,
    selectedStart: booked.selectedStart,
    lifecycleConfirmationSent: booked.lifecycle.smsSent === true,
  };
}
