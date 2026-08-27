import type { DemoScenarioBatch } from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";
import { demoSeed } from "~/server/speed2Lead/agent/demoFlow/testScenarios/seed";

export function buildDemoBatch4(): DemoScenarioBatch {
  return {
    batchId: "demo-batch-4",
    title: "Demo agent batch 4 — scheduling via shared core",
    scenarios: [
      {
        id: "d14-fake-demo-booking-not-real",
        title: "In-demo booking flag does not auto-book real meeting",
        seed: {
          ...demoSeed({
            demoSummary: {
              serviceAreaChecked: true,
              schedulingFlowCompleted: true,
              appointmentBookedInDemo: true,
              objectionsRaised: [],
              upsellPresented: false,
              topPositiveMoment: "booked in demo",
              topConcern: null,
              prospectSentiment: "positive",
            },
          }),
        },
        turns: [{ inbound: "Yeah we booked something in the demo — are we all set?" }],
        expectedChecks: ["fakeDemoBookingNotRealBooked"],
        reviewNotes: "appointmentBookedInDemo must not confirm a real sales meeting.",
      },
      {
        id: "d15-scheduling-mock-slots",
        title: "Positive bridge enters shared scheduling with mock slots",
        seed: {
          ...demoSeed({}),
          stage: "bridge",
          discoveryClosed: true,
        },
        turns: [{ inbound: "Sure, worth a look — send me some times" }],
        expectedChecks: ["enteredScheduling"],
        useMockSlots: true,
        reviewNotes: "Uses harness mock calendar like contact batch 4.",
      },
    ],
  };
}
