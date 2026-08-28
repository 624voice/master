import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import {
  contactBridgeReadySeed,
  contactDiscoveryOneAskedSeed,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import { nextWeekdayDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";

/** Batch 6 — Chris Aug 28 live-test regressions (cost answer + scheduling availability). */
export function buildContactBatch6(referenceDate = new Date()): ContactScenarioBatch {
  const profile = getActiveProfile();
  const timezone = profile.timezone;
  const mondayKey = nextWeekdayDateKey("Monday", referenceDate, timezone);
  const tuesdayKey = nextWeekdayDateKey("Tuesday", referenceDate, timezone);
  const sharedMeta = {
    timezone,
    referenceIso: referenceDate.toISOString(),
    mondayDateKey: mondayKey,
    tuesdayDateKey: tuesdayKey,
  };

  return {
    batchId: "contact-batch-6",
    title: "Contact agent batch 6 — cost-answer + scheduling availability regressions",
    scenarios: [
      {
        id: "c25-cost-answer-proceeds",
        title: "Few thousand/month cost answer proceeds without repeating consequence Q",
        seed: contactDiscoveryOneAskedSeed("Jordan"),
        turns: [
          {
            inbound:
              "They usually go to voicemail and we call back the next day, but half don't answer",
          },
          { inbound: "Few thousand a month", delayMs: 1500 },
        ],
        expectedChecks: ["costAnswerProceedsWithoutRepeat"],
        reviewNotes:
          "Vague-but-informative cost answers must not trigger a verbatim consequence re-ask.",
        meta: sharedMeta,
      },
      {
        id: "c26-monday-blocked-tuesday-open",
        title: "Monday fully booked mock still offers Tuesday slots",
        seed: contactBridgeReadySeed("Taylor"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "Monday", delayMs: 1500 },
          { inbound: "Tuesday", delayMs: 1500 },
        ],
        expectedChecks: ["mondayBlockedOffersTuesday"],
        reviewNotes:
          "Partially-booked calendar fixture — empty Monday must not block Tuesday availability.",
        meta: { ...sharedMeta, mondayBlockedCalendar: true, expectedDateKey: tuesdayKey },
        useMockSlots: true,
      },
      {
        id: "c27-pricing-mid-scheduling",
        title: "Pricing question mid-scheduling gets pricing copy, not availability fallback",
        seed: {
          ...contactBridgeReadySeed("Riley"),
          stage: "offering_slots",
          discoveryClosed: true,
          requestedDate: mondayKey,
          availabilityPreference: "full_day",
          offeredSlots: [],
        },
        turns: [{ inbound: "How does pricing work?" }],
        expectedChecks: ["pricingMidSchedulingNotStuck"],
        reviewNotes:
          "Non-scheduling replies must not be swallowed by the scheduling availability fallback.",
        meta: sharedMeta,
        useMockSlots: true,
      },
    ],
  };
}
