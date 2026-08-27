import type { DemoScenarioBatch } from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";
import { demoSeed } from "~/server/speed2Lead/agent/demoFlow/testScenarios/seed";

const sampleSummary = {
  serviceAreaChecked: true,
  schedulingFlowCompleted: false,
  appointmentBookedInDemo: false,
  objectionsRaised: ["pricing"],
  upsellPresented: true,
  topPositiveMoment: "natural scheduling flow",
  topConcern: "sounds robotic",
  prospectSentiment: "positive" as const,
};

export function buildDemoBatch2(): DemoScenarioBatch {
  return {
    batchId: "demo-batch-2",
    title: "Demo agent batch 2 — discovery, bridge, scheduling entry",
    scenarios: [
      {
        id: "d8-loved-it-bridge",
        title: "Positive reply moves toward business relevance",
        seed: demoSeed({ demoSummary: sampleSummary }),
        turns: [{ inbound: "Loved it — felt really natural" }],
        expectedChecks: ["contextualBridge"],
        reviewNotes: "First positive reply should bridge toward business relevance, not jump to slots.",
      },
      {
        id: "d9-immediate-meet",
        title: "Direct meeting intent skips discovery",
        seed: demoSeed({}),
        turns: [{ inbound: "Can we schedule a call this week?" }],
        expectedChecks: ["enteredScheduling"],
        reviewNotes: "Direct scheduling intent closes discovery immediately.",
      },
      {
        id: "d10-pricing-question",
        title: "Pricing question uses scoped answer",
        seed: demoSeed({}),
        turns: [{ inbound: "How much does this cost?" }],
        expectedChecks: ["pricingScopedAnswer"],
        reviewNotes: "Code-owned pricing copy — reply should mention setup/scope, not a dollar amount.",
      },
      {
        id: "d11-discovery-cap",
        title: "Discovery cap holds at two questions",
        seed: {
          ...demoSeed({}),
          discoveryQuestionCount: 0,
        },
        turns: [
          { inbound: "It was cool" },
          { inbound: "We miss a lot of calls" },
          { inbound: "Usually they call someone else" },
        ],
        expectedChecks: ["discoveryCapAtTwo"],
        reviewNotes: "Code guard should block a third discovery question.",
      },
    ],
  };
}
