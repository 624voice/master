import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ScenarioBatch } from "~/server/speed2Lead/agent/testScenarios/types";
import { nextWeekdayDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import { bridgeReadySeed } from "~/server/speed2Lead/agent/testScenarios/seed";

/** Batch 2 — priority items 6–12 (A–H chain folded into scenario 9). */
export function buildBatch2(referenceDate = new Date()): ScenarioBatch {
  const profile = getActiveProfile();
  const timezone = profile.timezone;
  const thursdayKey = nextWeekdayDateKey("Thursday", referenceDate, timezone);
  const fridayKey = nextWeekdayDateKey("Friday", referenceDate, timezone);

  const sharedMeta = {
    timezone,
    referenceIso: referenceDate.toISOString(),
    thursdayDateKey: thursdayKey,
    fridayDateKey: fridayKey,
  };

  return {
    batchId: "batch-2",
    title: "Edge-case priority items 6–12",
    profileTenantId: profile.tenantId,
    scenarios: [
      {
        id: "6-meeting-agree",
        title: "Prospect agrees — moves into scheduling with real slots",
        seed: bridgeReadySeed("Kai"),
        turns: [{ inbound: "Yeah sure, let's do it" }],
        expectedChecks: ["meetingAgreeOffersSlots"],
        reviewNotes: "Agreement should immediately produce concrete times, not more discovery.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "7-scheduling-preference-ask",
        title: "After agree, agent asks scheduling preference naturally",
        seed: bridgeReadySeed("Logan"),
        turns: [{ inbound: "Yes happy to chat" }],
        expectedChecks: ["meetingAgreeOffersSlots", "schedulingPreferenceAsked"],
        reviewNotes: "Wording should feel conversational, not form-like.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "8-real-calendar-slots",
        title: "Offered slots come from provider-shaped data",
        seed: bridgeReadySeed("Morgan"),
        turns: [{ inbound: "Sure, let's find a time" }],
        expectedChecks: ["meetingAgreeOffersSlots", "slotsFromProviderShape"],
        reviewNotes: "Labels should match CT timezone formatting.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "9ah-preference-chain",
        title: "A–H preference replacement chain (continuous)",
        seed: bridgeReadySeed("Avery"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "Evenings work better", delayMs: 2000 },
          { inbound: "What about 5?", delayMs: 2000 },
          { inbound: "4?", delayMs: 2000 },
          { inbound: "No 4pm", delayMs: 2000 },
          { inbound: "Then Friday", delayMs: 2000 },
          { inbound: "Need a morning time on Friday", delayMs: 2000 },
          { inbound: "10am?", delayMs: 2000 },
          { inbound: "What morning times do you have on Friday?", delayMs: 2000 },
        ],
        expectedChecks: ["ahAllSlotsOnFridayAfterE", "ahNoFourPmAfterReject", "ahMorningFridayAfterF"],
        reviewNotes:
          "Judge SMS clarity across the chain; mechanical checks cover Friday reset, 4pm rejection, and morning filter.",
        meta: sharedMeta,
        execution: "preview",
      },
      {
        id: "10-no-fabricated-times",
        title: "Calendar unavailable — no invented specific times",
        seed: bridgeReadySeed("Parker"),
        turns: [{ inbound: "Yes let's set something up" }],
        expectedChecks: ["noInventedTimesWhenUnavailable"],
        reviewNotes: "Apology + human follow-up is OK; naming fake 3pm slots is not.",
        meta: sharedMeta,
        execution: "local",
      },
      {
        id: "11-friday-clears-thursday",
        title: "Date change clears stale day constraints",
        seed: bridgeReadySeed("Quinn"),
        turns: [
          { inbound: "Sure" },
          { inbound: "How about Thursday?", delayMs: 2000 },
          { inbound: "Then Friday", delayMs: 2000 },
        ],
        expectedChecks: ["ahAllSlotsOnFridayAfterE"],
        reviewNotes: "Friday request should not silently keep Thursday slots.",
        meta: { ...sharedMeta, expectedDateKey: fridayKey },
        execution: "preview",
      },
      {
        id: "12-slot-selection",
        title: "Clear slot selection advances to confirming/booked",
        seed: bridgeReadySeed("Reese"),
        turns: [
          { inbound: "Yes let's book it" },
          { inbound: "The first one works", delayMs: 2500 },
          { inbound: "Yes book it", delayMs: 2500 },
        ],
        expectedChecks: ["slotSelectionAdvances"],
        reviewNotes: "Final booking confirmation may come from lifecycle SMS — stage check is the mechanical gate.",
        meta: sharedMeta,
        execution: "preview",
      },
    ],
  };
}

export const batch2 = buildBatch2();
