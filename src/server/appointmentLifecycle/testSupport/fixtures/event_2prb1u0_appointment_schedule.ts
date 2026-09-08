import type { GoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";

/**
 * Redacted production Appointment Schedule event `2prb1u0gu3287k6t5rbl2kd6t0`.
 * Preserves the shape that caused the parser defect:
 * organizer/self first, guest second without displayName, numeric-local-part
 * email, standalone guest phone, Booked-by description block.
 */
export const PRODUCTION_APPOINTMENT_SCHEDULE_EVENT: GoogleCalendarApiEvent = {
  id: "2prb1u0gu3287k6t5rbl2kd6t0",
  status: "confirmed",
  summary: "25 min w/ 624 Voice (PhaseA ProdSmoke)",
  description:
    "<b>Booked by</b>\nPhaseA ProdSmoke\ns2l.phasea.prod.1788905100222@example.com\n2149722278\n<br><b>Business Name</b>\nPhaseA Prod Smoke 1788905100222\n<br><b>Trade</b>\nHVAC\n<br><b>How many trucks are in your fleet? </b>\n5\n<br><b>Do you have a website?</b>\nno",
  created: "2026-09-08T22:08:59.000Z",
  updated: "2026-09-08T22:09:12.000Z",
  creator: {
    email: "info@624voice.com",
    self: true,
  },
  organizer: {
    email: "info@624voice.com",
    self: true,
  },
  start: {
    dateTime: "2026-09-11T15:30:00-05:00",
    timeZone: "America/Chicago",
  },
  end: {
    dateTime: "2026-09-11T15:55:00-05:00",
    timeZone: "America/Chicago",
  },
  attendees: [
    {
      email: "info@624voice.com",
      organizer: true,
      self: true,
      responseStatus: "accepted",
    },
    {
      email: "s2l.phasea.prod.1788905100222@example.com",
      responseStatus: "needsAction",
    },
  ],
  hangoutLink: "https://meet.google.com/fop-vvkt-trj",
  conferenceData: {
    createRequest: {
      requestId: "mlbva3mmbsnst5ve6cmplr13ls",
      status: { statusCode: "success" },
    },
    entryPoints: [
      {
        entryPointType: "video",
        uri: "https://meet.google.com/fop-vvkt-trj",
      },
      {
        entryPointType: "phone",
        uri: "tel:+1-513-970-3174",
      },
    ],
  },
};

export const PRODUCTION_GUEST_EMAIL = "s2l.phasea.prod.1788905100222@example.com";
export const PRODUCTION_GUEST_PHONE = "+12149722278";
export const PRODUCTION_GUEST_NAME = "PhaseA ProdSmoke";
export const CALENDAR_OWNER_EMAIL = "info@624voice.com";
export const FALSE_PHONE_FROM_EMAIL_LOCAL_PART = "+11788905100";
