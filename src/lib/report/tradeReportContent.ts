import { formatCurrency } from "~/lib/roi/formatCurrency";
import { SHARED, TRADES, type TradeKey } from "~/lib/roi/roiModel";
import type { TradeReportContent } from "~/lib/report/types";

function pct(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
}

function buildBlocks(trade: TradeKey): TradeReportContent["blocks"] {
  const t = TRADES[trade];
  const avgJob = formatCurrency(t.avgJobValue);
  const avgUpsell = formatCurrency(t.avgUpsellValue);
  const hourly = formatCurrency(SHARED.hourlyRate);

  return [
    {
      title: "Missed Calls",
      problem: `Roughly ${pct(t.missedCallRate)} of inbound calls go unanswered during peak hours, after hours, and overflow moments.`,
      consequence: `Each missed call is a ${avgJob} job that never enters the schedule — and often books with a competitor instead.`,
      response:
        "624Voice answers every call around the clock, qualifies the job, and books the appointment so revenue does not depend on who is at the desk.",
    },
    {
      title: "No-Shows",
      problem: `About ${pct(t.noShowRate)} of booked appointments no-show, leaving trucks and time slots empty.`,
      consequence: `Every no-show burns a dispatch slot and the marketing cost that created the lead — with ${avgJob} jobs at stake per missed visit.`,
      response:
        "Automated SMS confirmations and reminders cut no-shows before the truck rolls, protecting booked capacity.",
    },
    {
      title: "Upsell Revenue Left on the Table",
      problem:
        "Technicians finish the visit without offering maintenance plans, upgrades, or the next service while trust is highest.",
      consequence: `Post-job follow-up captures ${avgUpsell} add-on revenue that would otherwise walk out the door after every completed job.`,
      response:
        "624Voice triggers post-job sequences while the experience is fresh, prompting customers to accept offers your team already earned the right to make.",
    },
    {
      title: "A Customer List You're Not Using",
      problem:
        "Past customers sit dormant even though you already paid to acquire them.",
      consequence: `Proactive SMS campaigns turn that list into ${avgJob} repeat and seasonal jobs without new ad spend.`,
      response:
        "624Voice runs seasonal reminders, maintenance prompts, and win-back messages so existing customers hear from you first.",
    },
    {
      title: "Your Time",
      problem:
        "Scheduling, confirming, rescheduling, and logging calls consume admin hours every week.",
      consequence: `Manual coordination costs ${hourly} per hour in leadership and office time that never reaches the revenue line.`,
      response:
        "624Voice automates routine call handling and follow-up so your team spends time running the business, not chasing the phone.",
    },
  ];
}

export const TRADE_REPORT_CONTENT: Record<TradeKey, TradeReportContent> = {
  Plumbers: { blocks: buildBlocks("Plumbers") },
  Electricians: { blocks: buildBlocks("Electricians") },
  HVAC: { blocks: buildBlocks("HVAC") },
  Roofers: { blocks: buildBlocks("Roofers") },
  PestControl: { blocks: buildBlocks("PestControl") },
};
