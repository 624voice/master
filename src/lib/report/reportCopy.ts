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

export const PAGE1_CTA_PREVIEW =
  "See where it's going — and what it takes to recover it. →";

export const SECTION_01_TITLE = "Where the money is going";
export const SECTION_01_SUB =
  "The moderate estimate, broken into its five independent revenue drivers. No double-counting — each is calculated against a separate pool.";

export const SECTION_02_TITLE = "The money is leaking after the lead comes in";
export const SECTION_02_SUB =
  "You already paid to create the opportunity. These are the places revenue slips away before, during, and after the job.";

export const SECTION_02_PARAGRAPHS = [
  "The phone rings after hours. Nobody picks up. By morning, the homeowner already booked someone else.",
  "The truck rolls to an appointment and the house is empty. That slot — and the marketing that filled it — is gone.",
  "The tech finishes a solid job, closes the ticket, and never mentions the maintenance plan while trust is highest.",
  "Past customers sit in your list while seasonal demand passes and a competitor sends the reminder first.",
] as const;

export const SECTION_02_TURN =
  "None of it feels dramatic. That's why it keeps happening. Added up, the moderate model puts it at {moderateTotal} a year.";

export const SECTION_03_TITLE = "Five places revenue walks out";

export const SECTION_04_TITLE = "How your numbers were calculated";

export const SECTION_05_TITLE = "Our risk, not yours";

export const SECTION_06_TITLE = "What happens next...";

export const GUARANTEE_CARD_TITLE = "90-Day Results Guarantee";

/** Page 2 pool-separation note — canonical outcome vocabulary, not legacy driver names. */
export const NO_DOUBLE_COUNTING_NOTE =
  "Book More Jobs counts only calls currently going unanswered — a separate pool from your booked jobs.";

export const METHODOLOGY_PARAGRAPH =
  "Figures use scenario modeling against your entered call volume, trade assumptions listed below, and independent driver pools with no double-counting. Actual results vary by market, execution, and configuration.";

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

export const ABOUT_POSITIONING =
  "624Voice builds the AI systems that capture, convert, and recover revenue for home-service businesses.";

export const ABOUT_GROUPS = [
  {
    label: "Capture",
    items:
      "AI voice receptionists · AI chat · AI-optimized websites and redesigns",
  },
  {
    label: "Convert",
    items:
      "instant lead response · estimate follow-up · SMS confirmations and reminders",
  },
  {
    label: "Recover",
    items:
      "reactivation and upsell campaigns · automated review generation · outbound collections",
  },
] as const;

export const ABOUT_FOOTNOTE =
  "Backed by CRM integration, custom dashboards, and AI discoverability consulting.";

export type DriverCopyKey =
  | "missedCallRecovery"
  | "noShowReduction"
  | "jobCloserUpsells"
  | "outboundSms"
  | "timeSavings";

export const DRIVER_DISPLAY: Record<
  DriverCopyKey,
  { headline: string; subline: (monthlyUnits: number) => string }
> = {
  missedCallRecovery: {
    headline: "Book More Jobs",
    subline: (n) =>
      `Answer every call, day or night — and turn ${n} more of them into booked jobs a month.`,
  },
  noShowReduction: {
    headline: "Cut Your No-Shows",
    subline: (n) =>
      `Automated confirmations and reminders that save ${n} appointments a month from the empty-slot pile.`,
  },
  jobCloserUpsells: {
    headline: "Raise Your Average Ticket",
    subline: (n) =>
      `Post-job follow-up that turns ${n} more visits a month into plans, upgrades, and add-ons.`,
  },
  outboundSms: {
    headline: "Win More Repeat Revenue with Customers You Already Have",
    subline: (n) =>
      `Seasonal and win-back campaigns that pull ${n} more jobs a month out of your existing list — no new ad spend.`,
  },
  timeSavings: {
    headline: "Get Your Time Back",
    subline: (n) =>
      `Automated scheduling and follow-up that hands ${n} admin hours a month back to your team.`,
  },
};

export const DRIVER_DISPLAY_ORDER: DriverCopyKey[] = [
  "missedCallRecovery",
  "noShowReduction",
  "jobCloserUpsells",
  "outboundSms",
  "timeSavings",
];
