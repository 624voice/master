import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { contactBridgeReadySeed } from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";

/** Batch 3 — decline branches (timing, skepticism, second-decline exit). */
export function buildContactBatch3(): ContactScenarioBatch {
  return {
    batchId: "contact-batch-3",
    title: "Contact agent batch 3 — decline branching",
    scenarios: [
      {
        id: "c14-decline-timing-exit",
        title: "Decline diagnosis → timing reason → graceful exit",
        seed: contactBridgeReadySeed("Emery"),
        turns: [
          { inbound: "Probably not worth a meeting right now" },
          { inbound: "It's not a priority right now", delayMs: 1500 },
        ],
        expectedChecks: ["declineDiagnosisSent", "timingDeclineExit"],
        reviewNotes: "Code-owned decline path — timing objection exits without LLM.",
      },
      {
        id: "c15-decline-skepticism-response",
        title: "Decline diagnosis → skepticism → guarantee re-engage",
        seed: contactBridgeReadySeed("Finley"),
        turns: [
          { inbound: "Probably not worth a meeting" },
          { inbound: "I'm not convinced this would actually solve the problem", delayMs: 1500 },
        ],
        expectedChecks: ["declineDiagnosisSent", "skepticismDeclineResponse"],
        reviewNotes: "Skepticism path sends 90-day guarantee copy, stays in conversation.",
      },
      {
        id: "c16-second-decline-exit",
        title: "Skepticism re-engage → second decline → terminal exit",
        seed: contactBridgeReadySeed("Gray"),
        turns: [
          { inbound: "Probably not worth a meeting" },
          { inbound: "I'm not convinced it would work for us", delayMs: 1500 },
          { inbound: "No thanks, still not interested", delayMs: 1500 },
        ],
        expectedChecks: ["skepticismDeclineResponse", "secondDeclineExit"],
        reviewNotes: "Second meeting decline after skepticism path should exit cleanly.",
      },
    ],
  };
}
