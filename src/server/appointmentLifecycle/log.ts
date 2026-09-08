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
  | "sms_suppressed_no_consent"
  | "lifecycle_superseded"
  | "manual_cleanup_required"
  | "reminder_suppressed_reschedule_pending"
  | "reschedule_pending_expired"
  | "google_provider_diagnostic"
  | "meeting_intent_confirmed"
  | "booking_link_sent"
  | "booking_link_resent"
  | "booking_link_resent_after_campaign_exhausted"
  | "booking_link_followup_sent"
  | "booking_link_campaign_cancelled"
  | "identity_match_confirmed"
  | "identity_match_ambiguous"
  | "booking_unmatched"
  | "booking_source_attributed"
  | "booking_source_ambiguous"
  | "booking_confirmed"
  | "booking_replacement_matched"
  | "calendar_metadata_malformed_markers"
  | "calendar_metadata_patch_failed"
  | "booking_link_check_sync_failed"
  | "human_follow_up_created"
  | "human_follow_up_resolved"
  | "human_follow_up_booked_refused"
  | "human_follow_up_campaign_restored"
  | "human_alert_sent"
  | "global_opt_out_processed"
  | "global_opt_in_processed"
  | "compliance_help_received"
  | "lead_index_target_not_found"
  | "handoff_inbound_logged";

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
