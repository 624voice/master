import { formatCurrency } from "~/lib/roi/formatCurrency";
import { SHARED, TRADES, type TradeKey } from "~/lib/roi/roiModel";
import type { DriverCopyKey } from "~/lib/report/reportCopy";
import {
  LEAK_NARRATIVE_TITLES,
  NO_SHOW_NARRATIVE_CLOSE,
  PAGE2_NARRATIVE_PARAGRAPHS,
} from "~/lib/report/reportCopy";

export type NarrativeParagraph = {
  before: string;
  highlight?: string;
  after: string;
};

export type LeakNarrativeView = {
  title: string;
  paragraphs: NarrativeParagraph[];
};

function formatPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`.replace(/\.0%$/, "%");
}

function formatMoney(value: number): string {
  return formatCurrency(value).replace(/\.00$/, "");
}

function formatHourlyRate(): string {
  return `$${SHARED.hourlyRate}/hour`;
}

function formatNoShowReductionRange(): string {
  const min = Math.round(SHARED.noShowReduction[0] * 100);
  const max = Math.round(SHARED.noShowReduction[2] * 100);
  return `${min}–${max}%`;
}

export function buildLeakNarratives(trade: TradeKey): Record<DriverCopyKey, LeakNarrativeView> {
  const tradeData = TRADES[trade];
  const tradeLabel = tradeData.label;
  const missedCallRateFormatted = formatPct(tradeData.missedCallRate);
  const avgJobValueFormatted = formatMoney(tradeData.avgJobValue);
  const noShowRateFormatted = formatPct(tradeData.noShowRate);
  const hourlyRateFormatted = formatHourlyRate();
  const noShowClose = NO_SHOW_NARRATIVE_CLOSE.replace(
    "{noShowReductionRange}",
    formatNoShowReductionRange(),
  );

  return {
    missedCallRecovery: {
      title: LEAK_NARRATIVE_TITLES.missedCallRecovery,
      paragraphs: [
        {
          before:
            "Every call you don't answer is a job you didn't book — and a competitor who did. ",
          highlight: `Industry benchmarks put the missed-call rate for ${tradeLabel} at ${missedCallRateFormatted}. At a ${avgJobValueFormatted} average job value, that's not a rounding error.`,
          after:
            " It's a predictable, recurring loss that compounds every month.",
        },
        {
          before:
            "The fix isn't hiring another person to sit by the phone. It's a 24/7 AI receptionist that answers every call, qualifies the job, and books it — at 2am on a Sunday, the same as 9am on a Tuesday.",
          after: "",
        },
      ],
    },
    noShowReduction: {
      title: LEAK_NARRATIVE_TITLES.noShowReduction,
      paragraphs: [
        {
          before:
            "You paid for the lead. You answered the call. You scheduled the job. Your tech drove to the address — and the customer wasn't there. ",
          highlight: `Your modeled no-show rate is ${noShowRateFormatted}. Each one costs a blocked slot, a truck roll, and a job that could have gone to a paying customer.`,
          after: "",
        },
        {
          before: noShowClose,
          after: "",
        },
      ],
    },
    jobCloserUpsells: {
      title: LEAK_NARRATIVE_TITLES.jobCloserUpsells,
      paragraphs: [
        {
          before: "Your technician is standing inside a customer's home — ",
          highlight:
            "the single highest-trust moment in your entire business relationship",
          after:
            " — and they finish the job, say goodbye, and leave. No maintenance plan offered. No filter swap mentioned. No annual inspection booked.",
        },
        {
          before:
            "Post-job follow-up sequences, triggered automatically after the tech closes out, prompt the customer while the experience is fresh and capture upsell revenue that would otherwise disappear.",
          after: "",
        },
      ],
    },
    outboundSms: {
      title: LEAK_NARRATIVE_TITLES.outboundSms,
      paragraphs: [
        {
          before:
            "You've already paid to acquire every customer in your database. Most operators let that list sit and do nothing. Outbound SMS campaigns — seasonal reminders, maintenance prompts, win-back messages — ",
          highlight:
            "turn a dormant asset into a recurring revenue channel. The customers already trust you. They just need to hear from you.",
          after: "",
        },
      ],
    },
    timeSavings: {
      title: LEAK_NARRATIVE_TITLES.timeSavings,
      paragraphs: [
        {
          before:
            "Scheduling, confirming, rescheduling, following up, logging calls — you or someone on your team is doing this manually. Every hour spent on admin is an hour not spent running the business.",
          after: "",
        },
        {
          before: "",
          highlight: `Valued conservatively at ${hourlyRateFormatted},`,
          after:
            " operational time has real dollar cost. Automation doesn't just save headaches — it has a measurable ROI.",
        },
      ],
    },
  };
}

export { PAGE2_NARRATIVE_PARAGRAPHS };
