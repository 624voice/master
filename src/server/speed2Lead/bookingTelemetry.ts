export type BookingTelemetryStage =
  | "interpretation"
  | "availability"
  | "slot_state"
  | "precondition"
  | "recheck"
  | "create_event"
  | "persistence"
  | "confirmation";

export type BookingTelemetryEvent = {
  stage: BookingTelemetryStage;
  outcome: "started" | "success" | "failure" | "skipped";
  reason?: string;
  slotStart?: string;
  requestKey?: string;
  eventId?: string;
  phoneSuffix?: string;
};

export function logBookingTelemetry(event: BookingTelemetryEvent): void {
  console.log(
    JSON.stringify({
      component: "speed2LeadBooking",
      at: new Date().toISOString(),
      ...event,
    }),
  );
}
