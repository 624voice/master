/** Shared report copy — guarantee relocated verbatim from pdfReportContent.ts line 6. */
export const GUARANTEE_BODY =
  "We guarantee you recover at least our service investment in booked service-visit revenue within 90 days of go-live - or we keep working, for free, until you do.";

export const GUARANTEE_FOOTNOTE =
  "If we don't perform, you don't pay beyond the Results Engagement Period.";

export const REPORT_FOOTER_EMAIL = "info@624voice.com";
export const REPORT_FOOTER_SITE = "624voice.com";

export const PAGE1_HERO_HEADLINE = "Where your revenue is quietly walking out.";

export const PAGE1_SUPPORTING_LINE =
  "A tailored estimate of the recurring revenue leaking out of your business — calculated from your own call volume and trade benchmarks.";

export const SECTION_01_TITLE = "Where the money is going";

export const SECTION_02_TITLE = "The money is leaking after the lead comes in";

export const SECTION_02_REALIZATION_LEAD =
  "None of these losses feels big when it happens.";

export const SECTION_02_REALIZATION_BODY =
  "A missed call. An empty appointment. An upsell nobody offered. A customer nobody followed up with. A little admin work here and there.";

export const SECTION_02_REALIZATION_CLOSE =
  "Together, they become {moderateTotal} a year.";

export const SECTION_03_TITLE = "Five places revenue walks out";

export const SECTION_04_TITLE = "How your numbers were calculated";

export const SECTION_05_TITLE = "Our risk, not yours";

export const SECTION_06_TITLE = "What happens next...";

export const GUARANTEE_CARD_TITLE = "90-Day Results Guarantee";

export const NO_DOUBLE_COUNTING_NOTE =
  "Book More Jobs counts only calls currently going unanswered — a separate pool from your booked jobs.";

export const MODEL_CARD_EYEBROW = "YOUR MODEL";
export const MODEL_CARD_SUB =
  "Built from your business inputs + trade benchmarks";
export const MODEL_CARD_NO_DOUBLE =
  "No double-counting. Each opportunity is modeled against a separate revenue pool.";
export const MODEL_CARD_DISCLAIMER =
  "Estimates use your entered call volume and industry benchmarks. Actual results vary by market, execution and configuration.";

export const ROI_RECAP_HEADLINE =
  "Even the conservative model puts {conservativeTotal} a year on the table.";

export const ROI_RECAP_BODY =
  "Not from finding a whole new market — from capturing more of the opportunities already moving through your business.";

export const CTA_HEADLINE = "See your AI front office work live in 25 minutes.";
export const CTA_SUB =
  "Bring one real scenario from your business. We'll run it live — calls, follow-up, and lead response included.";

export const CTA_HIGHLIGHTS = [
  "Hear a call you'd normally miss get answered, qualified, and booked.",
  "Listen to it move between English and Spanish mid-conversation.",
  "Watch confirmation and reminder texts fire on their own.",
  "See a lead from your site or ads get a reply in seconds.",
] as const;

export const CTA_BUTTON = "Book your demo →";
export const CTA_FINE_PRINT = "No commitment. Just clarity.";

export const ORCHESTRATION_TITLE = "624Voice: Home Services AI Orchestration System";

export const ORCHESTRATION_COLUMNS = [
  {
    label: "CAPTURE",
    items: ["AI Voice Receptionists", "AI Chat", "AI-optimized websites"],
  },
  {
    label: "CONVERT",
    items: ["Instant lead response", "Estimate follow-up", "Confirmations + reminders"],
  },
  {
    label: "RECOVER",
    items: ["Reactivation + upsells", "Review automation", "Outbound collections"],
  },
] as const;

export const ORCHESTRATION_FOOTNOTE =
  "Connected by CRM integrations, custom dashboards, and AI discoverability consulting.";

export const RECAP_SCENARIO_SUB = "Modeled annual opportunity";

export type DriverCopyKey =
  | "missedCallRecovery"
  | "noShowReduction"
  | "jobCloserUpsells"
  | "outboundSms"
  | "timeSavings";

export const DRIVER_DISPLAY: Record<
  DriverCopyKey,
  { headline: string; shortMechanism: string }
> = {
  missedCallRecovery: {
    headline: "Book More Jobs",
    shortMechanism: "Answer every call, book more jobs",
  },
  noShowReduction: {
    headline: "Cut Your No-Shows",
    shortMechanism: "Confirmations and reminders",
  },
  jobCloserUpsells: {
    headline: "Raise Your Average Ticket",
    shortMechanism: "Post-job follow-up and upsells",
  },
  outboundSms: {
    headline: "Win More Repeat Revenue with Customers You Already Have",
    shortMechanism: "Seasonal and win-back campaigns",
  },
  timeSavings: {
    headline: "Get Your Time Back",
    shortMechanism: "Admin and follow-up automation",
  },
};

export const LEAK_ROW_COPY: Record<
  DriverCopyKey,
  { consequence: string; response: string }
> = {
  missedCallRecovery: {
    consequence: "Missed calls become missed jobs.",
    response: "Answers, qualifies and books 24/7.",
  },
  noShowReduction: {
    consequence: "Empty appointments burn capacity.",
    response: "Confirms and reminds automatically.",
  },
  jobCloserUpsells: {
    consequence: "Upsells left on the table after every job.",
    response: "Post-job follow-up while trust is highest.",
  },
  outboundSms: {
    consequence: "Existing customers never hear from you.",
    response: "Seasonal and win-back campaigns on autopilot.",
  },
  timeSavings: {
    consequence: "Admin work never reaches the revenue line.",
    response: "Automates calls, scheduling and follow-up.",
  },
};

export const DRIVER_DISPLAY_ORDER: DriverCopyKey[] = [
  "missedCallRecovery",
  "noShowReduction",
  "jobCloserUpsells",
  "outboundSms",
  "timeSavings",
];
