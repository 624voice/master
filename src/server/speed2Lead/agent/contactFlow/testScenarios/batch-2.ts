import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import {
  contactDiscoveryOneAskedSeed,
  contactSeed,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";

/** Batch 2 — discovery cap, consequence question, direct meeting skip, pricing resume. */
export function buildContactBatch2(): ContactScenarioBatch {
  return {
    batchId: "contact-batch-2",
    title: "Contact agent batch 2 — discovery guards, intent skip, pricing resume",
    scenarios: [
      {
        id: "c10-discovery-cap-enforced",
        title: "Third discovery question blocked after cap — real LLM turns",
        seed: contactDiscoveryOneAskedSeed("Avery"),
        turns: [
          { inbound: "They go to voicemail and we call back next day but half never answer" },
          { inbound: "Probably fifteen to twenty grand a year in lost revenue", delayMs: 2000 },
        ],
        expectedChecks: ["discoveryClosedAtCap", "noThirdDiscoveryQuestion"],
        reviewNotes:
          "One discovery question seeded — turn 1 must ask the second; turn 2 must not ask a third diagnostic question.",
      },
      {
        id: "c11-consequence-question",
        title: "Second discovery turn prefers consequence question",
        seed: contactDiscoveryOneAskedSeed("Blake"),
        turns: [{ inbound: "They usually go to voicemail and we call back the next day, but half don't answer" }],
        expectedChecks: ["consequenceQuestionUsed"],
        reviewNotes: "Second question should probe cost/impact, not another situation question.",
      },
      {
        id: "c12-direct-meeting-skip",
        title: "Direct meeting intent skips discovery for real slots",
        seed: contactSeed("clear", "We miss calls after hours", "better call handling", "Casey"),
        turns: [{ inbound: "Can we schedule a call this week?" }],
        expectedChecks: ["discoveryClosedAfterMeetingIntent", "meetingAgreeOffersSlots"],
        reviewNotes: "Explicit schedule intent should close discovery and offer calendar slots.",
      },
      {
        id: "c13-pricing-then-resume",
        title: "Pricing FAQ then resume scheduling state",
        seed: contactSeed("clear", "We miss calls after hours", "better call handling", "Drew"),
        turns: [
          { inbound: "How much does this cost?" },
          { inbound: "Ok fair enough, let's set up a call", delayMs: 2500 },
        ],
        expectedChecks: ["pricingResponseCopySent", "pricingResumesScheduling"],
        reviewNotes: "Code-owned pricing copy first; next turn should move into offering_slots with real slots.",
      },
    ],
  };
}
