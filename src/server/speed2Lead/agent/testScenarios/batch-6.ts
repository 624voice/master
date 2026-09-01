import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ScenarioBatch } from "~/server/speed2Lead/agent/testScenarios/types";
import { bridgeReadySeed, roiDiscoveryCapSeed } from "~/server/speed2Lead/agent/testScenarios/seed";

/** Batch 6 — ROI discovery cap + governed decline (audit-fix pass). */
export function buildBatch6(_referenceDate = new Date()): ScenarioBatch {
  const profile = getActiveProfile();

  return {
    batchId: "batch-6",
    title: "ROI audit fixes — discovery cap and governed decline",
    profileTenantId: profile.tenantId,
    scenarios: [
      {
        id: "26-roi-discovery-cap",
        title: "Third discovery question is hard-capped toward scheduling",
        seed: roiDiscoveryCapSeed("Jamie"),
        turns: [
          {
            inbound:
              "It's missed calls after hours, slow follow-up during the day, and the office is slammed — plus we lose jobs when nobody calls back the same day. Also after-hours voicemail just sits there.",
          },
        ],
        expectedChecks: ["roiDiscoveryCountAtMostTwo", "roiDiscoveryCappedTowardScheduling"],
        reviewNotes:
          "Two diagnostic questions already asked. A multi-topic ramble that invites more discovery must not produce a third diagnostic question — code should kick to scheduling.",
      },
      {
        id: "27-roi-first-decline-reframe",
        title: "First meeting decline gets one constrained reframe",
        seed: bridgeReadySeed("Jordan"),
        turns: [{ inbound: "probably not worth a meeting" }],
        expectedChecks: ["declineFirstTurnNotTerminal", "roiDeclineReframeUsesReportOrGuarantee"],
        reviewNotes:
          "ROI decline is now a dedicated constrained reframe (report context / guarantee), not a free LLM improvisation.",
      },
      {
        id: "28-roi-second-decline-exit",
        title: "Second consecutive meeting decline is a graceful exit",
        seed: {
          ...bridgeReadySeed("Kelly"),
          meetingDeclineCount: 1,
        },
        turns: [{ inbound: "nah I'm good, still not interested" }],
        expectedChecks: ["roiSecondDeclineGracefulExit"],
        reviewNotes: "Second consecutive decline must be terminal with the code-owned graceful exit — no second reframe.",
      },
    ],
  };
}

export const batch6 = buildBatch6();
