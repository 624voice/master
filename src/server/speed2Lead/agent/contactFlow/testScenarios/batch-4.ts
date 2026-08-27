import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { nextWeekdayDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";
import { contactBridgeReadySeed } from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";

/** Batch 4 — contact-flow scheduling + real-calendar booking. */
export function buildContactBatch4(referenceDate = new Date()): ContactScenarioBatch {
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
    batchId: "contact-batch-4",
    title: "Contact agent batch 4 — scheduling state + real calendar booking",
    scenarios: [
      {
        id: "c17-meeting-agree-offers-slots",
        title: "Bridge agree moves into scheduling with real slots",
        seed: contactBridgeReadySeed("Harper"),
        turns: [{ inbound: "Yeah sure, let's do it" }],
        expectedChecks: ["meetingAgreeOffersSlots"],
        reviewNotes: "Contact flow must offer real provider-shaped slots after meeting agreement.",
        meta: sharedMeta,
      },
      {
        id: "c18-real-calendar-slot-shape",
        title: "Offered slots have valid ISO + CT labels",
        seed: contactBridgeReadySeed("Indigo"),
        turns: [{ inbound: "Yes happy to chat" }],
        expectedChecks: ["meetingAgreeOffersSlots", "slotsFromProviderShape"],
        reviewNotes: "Same slot shape contract as ROI agent — contact context must not regress.",
        meta: sharedMeta,
      },
      {
        id: "c19-slot-selection-advances",
        title: "Slot selection advances to confirming or booked",
        seed: contactBridgeReadySeed("Jordan"),
        turns: [
          { inbound: "Yes let's book it" },
          { inbound: "The first one works", delayMs: 2500 },
        ],
        expectedChecks: ["slotSelectionAdvances"],
        reviewNotes: "Selection should advance stage without restarting discovery.",
        meta: sharedMeta,
      },
      {
        id: "c20-full-in-sms-booking",
        title: "Full in-SMS booking on real calendar (contact source)",
        seed: contactBridgeReadySeed("Kai"),
        turns: [
          { inbound: "Yes let's schedule" },
          { inbound: "The first one works", delayMs: 2500 },
          { inbound: "Yes book it", delayMs: 2500 },
        ],
        expectedChecks: ["slotSelectionAdvances", "contactFlowBooked"],
        reviewNotes:
          "End-to-end book in contact flow — verifies scheduling core in this context, not just ROI.",
        meta: sharedMeta,
      },
      {
        id: "c21-friday-clears-thursday",
        title: "Friday request clears stale Thursday constraints",
        seed: contactBridgeReadySeed("Logan"),
        turns: [
          { inbound: "Sure, let's find a time" },
          { inbound: "How about Thursday?", delayMs: 2000 },
          { inbound: "Then Friday", delayMs: 2000 },
        ],
        expectedChecks: ["fridaySlotsAfterDateChange"],
        reviewNotes: "Date pivot must reset day filter — same bug class ROI batch 2 caught.",
        meta: { ...sharedMeta, expectedDateKey: fridayKey },
        useMockSlots: true,
      },
      {
        id: "c22-provider-failure-no-invented-times",
        title: "Calendar failure — no invented specific times",
        seed: contactBridgeReadySeed("Morgan"),
        turns: [{ inbound: "Yes let's set something up" }],
        expectedChecks: ["noInventedTimesWhenUnavailable"],
        reviewNotes: "Forced provider failure locally — apology OK, fake 3pm slots are not.",
        meta: { ...sharedMeta, calendarFetchFailure: true },
        useMockSlots: true,
      },
    ],
  };
}
