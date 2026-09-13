export const FEATURE_FLAGS = {
  REQUIRE_LEAD_FOR_PDF: true,
  REQUIRE_LEAD_FOR_RESULTS: true,
  ASSESSMENT_ENABLED: true,
  ASSESSMENT_RATE_LIMIT_ENABLED: true,
  ASSESSMENT_REPORT_TOKENS_ENABLED: true,
  ASSESSMENT_ANALYTICS_ENABLED: true,
  ASSESSMENT_SMS_PIPELINE_ENABLED: true,
} as const;

/** When false, assessment submissions skip live Speed2Lead ROI agent SMS. */
export const ASSESSMENT_ROI_AGENT_LIVE_ENABLED = false;

export const MAX_TRUCK_COUNT = 50;

export const SITE_ORIGIN = "https://624voice.com";

export const BOOK_MEETING_PATH = "/book";

export const BOOK_MEETING_EMBED_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1CEXxMkoNtwq-TOz0iC57blk5aJVs5XlOA55dp9X0lUmNftEd7p9bJI4cXpD5aMnoUiXqBpoDc?gv=true";

/** External calendar link for PDF downloads and direct sharing. */
export const BOOK_MEETING_URL =
  "https://calendar.app.google/hpzTSkjb9NTqaMjh9";

/** Speed2Lead SMS booking link — operator calendar for info@624voice.com. */
export const SPEED2LEAD_BOOKING_URL =
  "https://calendar.app.google/Jy8NRQgZrm5XFVRw9";

export const ROI_DISCLAIMER =
  "Estimates based on industry averages. Your results may vary.";
