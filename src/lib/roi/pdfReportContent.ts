export const PDF_TITLE = "YOUR PERSONALIZED REVENUE GAP REPORT";
export const PDF_SUBTITLE =
  "What your business stands to gain - and how we calculated it.";

export const GUARANTEE_BODY =
  "We guarantee you recover at least our service investment in booked service-visit revenue within 90 days of go-live - or we keep working, for free, until you do.";
export const GUARANTEE_FOOTNOTE =
  "If we don't perform, you don't pay beyond the Results Engagement Period.";

export type PdfNarrativeSection = {
  title: string;
  paragraphs: string[];
  subsections?: { title: string; paragraphs: string[] }[];
};

export const NARRATIVE_SECTIONS: PdfNarrativeSection[] = [
  {
    title: "THE LEAKY BUCKET PROBLEM",
    paragraphs: [
      "Most home service businesses aren't losing money because they lack customers. They're losing it because the system they're running has holes in it - and those holes have become so routine, they've stopped being noticed.",
      "The phone rings after hours. Nobody answers. The customer moves on.",
      "A job gets booked. The truck shows up. The customer doesn't.",
      "The technician finishes the job, shakes hands, walks out the door - and never mentions the maintenance plan, the upgrade, or the next service.",
      "None of this feels dramatic. But at scale, it's quietly bleeding thousands of dollars per month out of businesses that are otherwise running well.",
      "This report breaks down exactly where that money is going - and what it's worth to stop the leak.",
    ],
  },
  {
    title: "THE FIVE PLACES YOUR REVENUE IS WALKING OUT THE DOOR",
    paragraphs: [],
    subsections: [
      {
        title: "1. Missed Calls",
        paragraphs: [
          "Every call you don't answer is a job you didn't book - and a competitor who did. Industry benchmarks put the missed call rate for residential trade businesses around 20%. At a $350 average job value, that's not a rounding error. It's a predictable, recurring revenue loss that compounds every single month.",
          "The fix isn't hiring another person to sit by the phone. It's a 24/7 AI receptionist that answers every call, qualifies the job, and books the appointment - at 2am on a Sunday, the same as 9am on a Tuesday.",
        ],
      },
      {
        title: "2. No-Shows",
        paragraphs: [
          "You paid to get the lead. You answered the call. You scheduled the job. Your tech drove to the address. And the customer wasn't there.",
          "No-shows run 10-15% in most residential service trades. Each one costs you a blocked time slot, a truck roll, and a job that could have gone to a paying customer. Automated SMS confirmations and reminders - sent at the right intervals before the appointment - cut no-show rates by 25-55%. That's not a small number when you're running it against your full booking volume.",
        ],
      },
      {
        title: "3. Upsell Revenue Left on the Table",
        paragraphs: [
          "Your technician is standing inside a customer's home - the single highest-trust moment in your entire business relationship - and they finish the job, say goodbye, and leave.",
          "No maintenance plan offered. No filter swap mentioned. No annual inspection booked.",
          "The opportunity cost here is consistent and invisible. Post-job follow-up sequences, triggered automatically after the tech closes out, prompt the customer while the experience is fresh and capture upsell revenue that would otherwise disappear.",
        ],
      },
      {
        title: "4. A Customer List You're Not Using",
        paragraphs: [
          "You've already paid to acquire every customer in your database. Most operators let that list sit there and do nothing.",
          "Outbound SMS campaigns - seasonal reminders, maintenance prompts, win-back messages - turn a dormant asset into a recurring revenue channel. The customers already trust you. They just need to hear from you.",
        ],
      },
      {
        title: "5. Your Time",
        paragraphs: [
          "Scheduling, confirming, rescheduling, following up, logging calls - you or someone on your team is doing this manually. Every hour spent on admin is an hour not spent running the business. Valued conservatively at $75/hour, operational time has real dollar cost. Automation doesn't just save headaches. It has a measurable ROI.",
        ],
      },
    ],
  },
  {
    title: "HOW YOUR NUMBERS WERE CALCULATED",
    paragraphs: [
      "The figures in this report are built from the call volume you entered, run through trade-specific assumptions and three scenario tiers.",
      "Conservative applies a 15% booking rate on recovered missed calls, a 25% reduction in no-shows, 2 additional jobs per month from outbound campaigns, a 5% upsell rate, and 10 admin hours saved monthly.",
      "Moderate applies a 25% booking rate, 40% no-show reduction, 4 campaign jobs per month, 10% upsell rate, and 20 hours saved.",
      "Aggressive applies a 35% booking rate, 55% no-show reduction, 6 campaign jobs per month, 15% upsell rate, and 30 hours saved.",
      "Each driver is calculated independently. There is no double-counting.",
      "Missed call recovery applies only to calls currently going unanswered - a separate pool from your existing booked jobs. No-show savings apply only to your baseline appointment volume. Upsell revenue is calculated against the same baseline job pool as no-shows, but measures a different outcome entirely. Outbound campaign revenue is driven by proactive outreach - completely independent of inbound call volume.",
      "Every figure in this report is calculated net of your platform investment. Your 624 Voice specialist will walk you through the full investment on your demo call.",
    ],
  },
  {
    title: "WHAT THIS MEANS FOR YOU",
    paragraphs: [
      "This isn't a magic number. Your actual results will depend on your market, your team's execution, and how the system is configured and dialed in for your specific operation.",
      "What the math shows is that for a business running your call volume, the opportunity is real - across all three scenarios, the return is meaningful relative to the investment.",
      "Across every scenario modeled, the return exceeds the investment - and in most cases, significantly.",
      "The question isn't whether the math works. The question is whether you want to find out if it works for your business specifically.",
    ],
  },
];

export const NEXT_STEPS_TITLE = "THE NEXT STEP IS A 25-MINUTE DEMO";
export const NEXT_STEPS_PARAGRAPHS = [
  "In 25 minutes, you'll see the system live - the AI receptionist handling a real conversation, the follow-up sequences, and the outbound campaigns.",
  "You'll get answers to every question before spending a dollar.",
];
export const BOOK_DEMO_LABEL = "BOOK YOUR DEMO ->";
