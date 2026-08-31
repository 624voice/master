import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import {
  contactBridgeReadySeed,
  contactDiscoveryOneAskedSeed,
  contactOpenerClearSeed,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";

/** Batch 7 — Chris Aug 28 P0 calendar failure + discovery/scheduling regressions. */
export function buildContactBatch7(referenceDate = new Date()): ContactScenarioBatch {
  const profile = getActiveProfile();
  const sharedMeta = {
    timezone: profile.timezone,
    referenceIso: referenceDate.toISOString(),
  };

  return {
    batchId: "contact-batch-7",
    title: "Contact agent batch 7 — calendar failure guards + discovery ordering",
    scenarios: [
      {
        id: "c28-calendar-failure-no-fake-booking",
        title: "Calendar fetch failure never claims a completed booking or Zoom",
        seed: contactBridgeReadySeed("Avery"),
        turns: [{ inbound: "Monday afternoon" }],
        expectedChecks: [
          "noFakeBookingOnCalendarFailure",
          "noUnauthorizedMeetingPlatform",
          "schedulingFailureFlagged",
        ],
        reviewNotes:
          "Forced provider failure — must not say 'booked you' or invent Zoom; flag session for follow-up.",
        meta: { ...sharedMeta, calendarFetchFailure: true },
        useMockSlots: true,
      },
      {
        id: "c29-discovery-before-booking-ask",
        title: "Opener reply must include discovery before bridge/scheduling ask",
        seed: contactOpenerClearSeed("Blake"),
        turns: [
          {
            inbound:
              "Yeah we miss a few after hours and it hurts — probably a couple jobs a month",
          },
        ],
        expectedChecks: ["discoveryBeforeBookingAsk", "atMostOneQuestionPerReply"],
        reviewNotes:
          "Must ask consequence/discovery before combined bridge+day ask; no skipping straight to scheduling.",
        meta: sharedMeta,
      },
      {
        id: "c30-no-combined-bridge-and-day",
        title: "Bridge and day ask are never combined in one SMS",
        seed: contactDiscoveryOneAskedSeed("Casey"),
        turns: [{ inbound: "Few thousand a month in lost jobs" }],
        expectedChecks: ["atMostOneQuestionPerReply", "noCombinedBridgeAndDayAsk"],
        reviewNotes: "Worth-25-minutes and what-day-works must not appear in the same outbound.",
        meta: sharedMeta,
      },
    ],
  };
}
