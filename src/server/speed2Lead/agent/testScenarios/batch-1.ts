import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ScenarioBatch } from "~/server/speed2Lead/agent/testScenarios/types";
import {
  addCalendarDaysInTimezone,
  dateKeyInTimezone,
  formatExactDateLabel,
  nextWeekdayDateKey,
  tomorrowDateKey,
} from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import {
  bridgeReadySeed,
  painPromptConversationSeed,
  stopTestSeed,
} from "~/server/speed2Lead/agent/testScenarios/seed";

/**
 * Batch 1 — priority items 1–5 from the validation list.
 * Call `buildBatch1()` at runtime so date-relative scenarios use the real current date.
 */
export function buildBatch1(referenceDate = new Date()): ScenarioBatch {
  const profile = getActiveProfile();
  const timezone = profile.timezone;
  const tomorrowKey = tomorrowDateKey(referenceDate, timezone);
  const mondayKey = nextWeekdayDateKey("Monday", referenceDate, timezone);
  const exactAnchor = addCalendarDaysInTimezone(referenceDate, timezone, 4);
  const exactDateKey = dateKeyInTimezone(exactAnchor, timezone);
  const exactDateLabel = formatExactDateLabel(exactAnchor, timezone);

  const sharedMeta = {
    timezone,
    referenceIso: referenceDate.toISOString(),
  };

  return {
    batchId: "batch-1",
    title: "Edge-case priority items 1–5",
    profileTenantId: profile.tenantId,
    scenarios: [
      {
        id: "1-not-sure",
        title: 'No ROI read / "not sure" — not treated as agreement',
        seed: painPromptConversationSeed("Jamie"),
        turns: [{ inbound: "not sure" }],
        expectedChecks: ["notSureNotAgreement", "notSureNoVerbatimPainReask", "notSureFollowUpPresent"],
        reviewNotes:
          "Judge tone and brevity: follow-up should feel natural, not robotic; should not pressure toward a meeting yet.",
      },
      {
        id: "2-meeting-decline",
        title: "Meeting decline → one overcome → surrender",
        seed: bridgeReadySeed("Jordan"),
        turns: [
          { inbound: "probably not worth a meeting" },
          { inbound: "nah I'm good, still not interested", delayMs: 1500 },
        ],
        expectedChecks: [
          "declineFirstTurnNotTerminal",
          "declineFirstTurnOvercome",
          "declineSecondTurnTerminal",
          "declineNoReplyAfterSecond",
        ],
        reviewNotes:
          "First counter-argument should be brief and tied to missed-calls ROI; final message should respect the no gracefully.",
      },
      {
        id: "3-stop",
        title: "Explicit STOP → immediate stop",
        seed: stopTestSeed("Casey"),
        turns: [{ inbound: "STOP" }],
        expectedChecks: [
          "stopOptedOut",
          "stopDequeuedPainPrompt",
          "stopDequeuedNoResponse",
          "stopDequeuedNurture",
          "stopNoOutboundAfterStop",
          "stopNoAssistantTranscriptAfterStop",
        ],
        reviewNotes:
          "Carrier sends the compliance STOP confirmation — agent must stay silent. Cron replay after STOP should also stay silent.",
        meta: { ...sharedMeta, exerciseCronsAfterStop: true },
      },
      {
        id: "4a-date-tomorrow",
        title: 'Date preference resolves to "tomorrow"',
        seed: bridgeReadySeed("Dana"),
        turns: [
          { inbound: "Yeah sure, let's find a time" },
          { inbound: "tomorrow", delayMs: 2000 },
        ],
        expectedChecks: ["dateAllSlotsOnExpectedDay", "dateSlotsMatchExpectedWeekday"],
        reviewNotes: "Reply wording should sound natural; slot labels should read clearly in CT.",
        meta: { ...sharedMeta, expectedDateKey: tomorrowKey, preference: "tomorrow" },
      },
      {
        id: "4b-date-weekday",
        title: 'Date preference resolves to weekday "Monday"',
        seed: bridgeReadySeed("Ellis"),
        turns: [
          { inbound: "Yes, happy to chat" },
          { inbound: "Monday works best", delayMs: 2000 },
        ],
        expectedChecks: ["dateAllSlotsOnExpectedDay", "dateSlotsMatchExpectedWeekday"],
        reviewNotes: "Should pick the nearest upcoming Monday, not a wrong week silently.",
        meta: { ...sharedMeta, expectedDateKey: mondayKey, preference: "Monday" },
      },
      {
        id: "4c-date-exact",
        title: `Date preference resolves to exact date (${exactDateLabel})`,
        seed: bridgeReadySeed("Finley"),
        turns: [
          { inbound: "Sure, let's do it" },
          { inbound: exactDateLabel, delayMs: 2000 },
        ],
        expectedChecks: ["dateAllSlotsOnExpectedDay", "dateSlotsMatchExpectedWeekday"],
        reviewNotes: "Exact-date phrasing should be understood without asking for reformatting.",
        meta: { ...sharedMeta, expectedDateKey: exactDateKey, preference: exactDateLabel },
      },
      {
        id: "5a-daypart-morning",
        title: 'Daypart preference "morning"',
        seed: bridgeReadySeed("Gray"),
        turns: [
          { inbound: "Yeah let's schedule something" },
          { inbound: "morning works best", delayMs: 2000 },
        ],
        expectedChecks: ["daypartMorningSlots"],
        reviewNotes: "Morning filter should still leave enough options; reply should not over-explain.",
        meta: { ...sharedMeta, daypart: "morning" },
      },
      {
        id: "5b-daypart-afternoon",
        title: 'Daypart preference "afternoon"',
        seed: bridgeReadySeed("Harper"),
        turns: [
          { inbound: "Yes, book me in" },
          { inbound: "afternoon is better", delayMs: 2000 },
        ],
        expectedChecks: ["daypartAfternoonSlots"],
        reviewNotes: "Afternoon slots only; avoid offering 8am-style times.",
        meta: { ...sharedMeta, daypart: "afternoon" },
      },
      {
        id: "5c-daypart-anytime",
        title: 'Daypart preference "anytime" — no clarifying question',
        seed: bridgeReadySeed("Indigo"),
        turns: [
          { inbound: "Sure, let's set it up" },
          { inbound: "anytime works", delayMs: 2000 },
        ],
        expectedChecks: ["daypartAnytimeNoClarify", "daypartAnytimeOffersSlots"],
        reviewNotes: "Should present concrete times immediately, not ask morning vs afternoon.",
        meta: { ...sharedMeta, daypart: "anytime" },
      },
    ],
  };
}

/** Static export for harness default path resolution. */
export const batch1 = buildBatch1();
