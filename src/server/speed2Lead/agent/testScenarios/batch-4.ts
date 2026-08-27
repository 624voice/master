import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ScenarioBatch } from "~/server/speed2Lead/agent/testScenarios/types";
import { bridgeReadySeed } from "~/server/speed2Lead/agent/testScenarios/seed";

/** Batch 4 — priority items 18–22 (booking/scheduling hardening). */
export function buildBatch4(referenceDate = new Date()): ScenarioBatch {
  const profile = getActiveProfile();
  const sharedMeta = {
    timezone: profile.timezone,
    referenceIso: referenceDate.toISOString(),
  };

  return {
    batchId: "batch-4",
    title: "Edge-case priority items 18–22",
    profileTenantId: profile.tenantId,
    scenarios: [
      {
        id: "18-provider-conflict",
        title: "Real provider conflict may produce conflict language",
        seed: bridgeReadySeed("Blake"),
        turns: [
          { inbound: "The first one works" },
          { inbound: "Yes book it", delayMs: 2000 },
        ],
        expectedChecks: ["providerConflictLanguage"],
        reviewNotes:
          "Harness pre-occupies the first offered slot on the real calendar, then retries booking it.",
        meta: { ...sharedMeta, occupyFirstOfferedSlot: true },
        execution: "preview",
      },
      {
        id: "19-no-reconfirmation",
        title: "Clear offered-slot selection books without redundant reconfirmation",
        seed: bridgeReadySeed("Casey"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "The first one works", delayMs: 2500 },
        ],
        expectedChecks: ["booksWithoutReconfirmation"],
        reviewNotes: "Selection turn should not ask 'should I book?' — advance to booked or confirming.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "20-pricing-during-scheduling",
        title: "Pricing FAQ during scheduling preserves schedule state",
        seed: bridgeReadySeed("Drew"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "How does pricing work?", delayMs: 2000 },
        ],
        expectedChecks: ["pricingPreservesScheduleState"],
        reviewNotes: "Answer pricing briefly; keep offeredSlots and scheduling stage intact.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "21-provider-failure-no-async",
        title: "Provider failure does not invent async future work",
        seed: bridgeReadySeed("Emery"),
        turns: [{ inbound: "Yes let's find a time" }],
        expectedChecks: ["providerFailureNoAsyncWork", "noInventedTimesWhenUnavailable"],
        reviewNotes: "Calendar fetch forced to fail locally — no 'check back later' language.",
        meta: { ...sharedMeta, calendarFetchFailure: true },
        execution: "local",
        useMockSlots: true,
      },
      {
        id: "22-booked-no-restart",
        title: "Confirmed booking cannot restart scheduling",
        seed: bridgeReadySeed("Finley"),
        turns: [{ inbound: "Can we move it to Monday afternoon?" }],
        expectedChecks: ["bookedStateNotRestarted"],
        reviewNotes: "Post-book reschedule request must not wipe booked state or re-offer fresh slots.",
        meta: {
          ...sharedMeta,
          seedBookedStartIso: "2026-08-31T14:00:00.000Z",
          seedBookedEventId: "harness-seed-booked",
        },
        execution: "preview",
      },
    ],
  };
}

export const batch4 = buildBatch4();
