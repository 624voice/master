export type AppointmentLogEvent =
  | "booking_detected"
  | "booking_matched"
  | "unmatched_booking"
  | "confirmation_sent"
  | "reminder_scheduled"
  | "reminder_sent"
  | "reminder_suppressed"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "sms_suppressed_opt_out"
  | "duplicate_prevented"
  | "calendar_api_error"
  | "twilio_error"
  | "lifecycle_handoff"
  | "reschedule_pending"
  | "cancellation_failed";

export function logAppointmentEvent(
  event: AppointmentLogEvent,
  details: Record<string, string | number | boolean | undefined>,
): void {
  console.log(
    JSON.stringify({
      component: "appointmentLifecycle",
      event,
      at: new Date().toISOString(),
      ...details,
    }),
  );
}
