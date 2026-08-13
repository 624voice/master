export type S2LSource = "roi" | "contact" | "demo";

export type AppointmentLifecycleStatus =
  | "lead_active"
  | "booking_detected"
  | "confirmed"
  | "reminder_24h_sent"
  | "reminder_2h_sent"
  | "meeting_due"
  | "completed"
  | "reschedule_pending"
  | "rescheduled"
  | "cancelled"
  | "unmatched_booking";

export type LeadIndexEntry = {
  phone: string;
  email?: string;
  firstName: string;
  lastName?: string;
  businessName?: string;
  source: S2LSource;
  registeredAt: string;
  selfReportedBookingAt?: string;
  shortNeedSummary?: string;
};

export type CalendarEventStatus = "confirmed" | "cancelled" | "tentative";

/** Normalized calendar event used by sync + matching. */
export type NormalizedCalendarEvent = {
  calendarEventId: string;
  status: CalendarEventStatus;
  summary?: string;
  description?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  attendeePhone?: string;
  appointmentStart: string;
  appointmentEnd: string;
  timezone: string;
  meetingLink?: string;
  rescheduleLink?: string;
  updatedAt: string;
};

export type MatchMethod = "phone" | "email" | "correlation" | "name" | "none";

export type MatchResult =
  | {
      matched: true;
      lead: LeadIndexEntry;
      method: MatchMethod;
      confidence: "high" | "medium";
    }
  | {
      matched: false;
      reason: string;
      diagnostic: Record<string, string | undefined>;
    };

export type AppointmentLifecycleRecord = {
  calendarEventId: string;
  phone?: string;
  email?: string;
  firstName?: string;
  businessName?: string;
  source?: S2LSource;
  appointmentStart: string;
  appointmentEnd: string;
  timezone: string;
  eventStatus: CalendarEventStatus;
  lifecycleStatus: AppointmentLifecycleStatus;
  meetingLink?: string;
  rescheduleLink?: string;
  matchMethod?: MatchMethod;
  confirmationSentAt?: string;
  reminder24hSentAt?: string;
  reminder2hSentAt?: string;
  cancelledAt?: string;
  rescheduledFromEventId?: string;
  rescheduledToEventId?: string;
  reschedulePendingAt?: string;
  selfReportedBeforeDetection?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderKind = "24h" | "2h";

export type ProcessEventResult = {
  eventId: string;
  action:
    | "created"
    | "updated"
    | "cancelled"
    | "rescheduled"
    | "unmatched"
    | "duplicate_skipped"
    | "no_action";
  smsSent?: boolean;
  messageType?: "confirmation" | "reschedule_confirmation" | "cancellation";
};
