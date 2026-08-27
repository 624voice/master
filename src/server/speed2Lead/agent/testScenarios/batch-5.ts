import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ScenarioBatch } from "~/server/speed2Lead/agent/testScenarios/types";
import { bridgeReadySeed } from "~/server/speed2Lead/agent/testScenarios/seed";

/** Batch 5 — priority items 23–25 (confirmation + post-book, final batch). */
export function buildBatch5(referenceDate = new Date()): ScenarioBatch {
  const profile = getActiveProfile();
  const sharedMeta = {
    timezone: profile.timezone,
    referenceIso: referenceDate.toISOString(),
  };

  return {
    batchId: "batch-5",
    title: "Edge-case priority items 23–25",
    profileTenantId: profile.tenantId,
    scenarios: [
      {
        id: "23-confirmation-details",
        title: "Confirmation SMS contains day, time, and Meet link",
        seed: bridgeReadySeed("Gray"),
        turns: [
          { inbound: "Yes let's book it" },
          { inbound: "The first one works", delayMs: 2500 },
          { inbound: "Yes book it", delayMs: 2500 },
        ],
        expectedChecks: ["confirmationHasDetails", "slotSelectionAdvances"],
        reviewNotes: "Lifecycle confirmation must include concrete appointment details and Meet URL.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "24-confirmation-no-holding",
        title: "Confirmation has no holding/shortly/link-later language",
        seed: bridgeReadySeed("Harper"),
        turns: [
          { inbound: "Sure let's schedule" },
          { inbound: "The first one works", delayMs: 2500 },
          { inbound: "Yes book it", delayMs: 2500 },
        ],
        expectedChecks: ["confirmationNoHoldingLanguage", "slotSelectionAdvances"],
        reviewNotes: "Booked confirmation must be definitive — no deferred link delivery.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "25-post-book-question",
        title: "Post-book question answered without breaking booking state",
        seed: bridgeReadySeed("Indigo"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "The first one works", delayMs: 2500 },
          { inbound: "Yes book it", delayMs: 2500 },
          { inbound: "What should I prepare for the call?", delayMs: 3000 },
        ],
        expectedChecks: ["postBookQuestionPreservesBooking"],
        reviewNotes: "Target end-state item 18 — answer helpfully, stay booked, do not re-enter scheduling.",
        meta: sharedMeta,
        execution: "preview",
      },
    ],
  };
}

export const batch5 = buildBatch5();
