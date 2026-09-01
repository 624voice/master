import type { DemoScenarioBatch } from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";
import { demoSeed } from "~/server/speed2Lead/agent/demoFlow/testScenarios/seed";

export function buildDemoBatch3(): DemoScenarioBatch {
  return {
    batchId: "demo-batch-3",
    title: "Demo agent batch 3 — decline and no-response copy",
    scenarios: [
      {
        id: "d12-decline-twice",
        title: "Second meeting decline is terminal",
        seed: {
          ...demoSeed({}),
          stage: "bridge",
          meetingDeclineCount: 1,
        },
        turns: [{ inbound: "Nah not interested" }],
        expectedChecks: ["declineTerminal"],
        reviewNotes: "After one reframe, second decline surrenders.",
      },
      {
        id: "d13-no-response-stage0",
        title: "Completed-demo no-response stage 0 copy",
        seed: {
          ...demoSeed({}),
          enqueueNoResponse: true,
          noResponseStage: 0,
        },
        turns: [],
        expectedChecks: ["noResponseStage0Copy"],
        reviewNotes: "Template check for +4h drip copy.",
        mechanicalOnly: true,
      },
      {
        id: "d13b-no-response-stage3-guarantee",
        title: "Demo no-response Day 6 cites the 90-day guarantee",
        seed: demoSeed({}),
        turns: [],
        expectedChecks: ["noResponseStage3Guarantee"],
        reviewNotes: "Stage-3 drip must source resultsGuarantee from AgentProfile.",
        mechanicalOnly: true,
      },
      {
        id: "d13c-no-response-stage4-guarantee",
        title: "Demo no-response Day 10 cites the 90-day guarantee",
        seed: demoSeed({}),
        turns: [],
        expectedChecks: ["noResponseStage4Guarantee"],
        reviewNotes: "Stage-4 drip must source resultsGuarantee from AgentProfile.",
        mechanicalOnly: true,
      },
    ],
  };
}
