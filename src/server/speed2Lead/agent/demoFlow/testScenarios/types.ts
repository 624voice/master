import type { DemoCallOutcome, DemoSummary } from "~/server/speed2Lead/agent/demoFlow/types";
import type { ScenarioMessage } from "~/server/speed2Lead/agent/testScenarios/types";

export const DEMO_HARNESS_PHONE = "+12149722278";

export type DemoScenarioSeed = {
  flow: "demo";
  firstName: string;
  businessName: string;
  callOutcome: DemoCallOutcome;
  callDurationSeconds: number;
  demoSummary: DemoSummary | null;
  vapiCallId?: string;
  stage?: "discovery" | "bridge" | "offering_slots" | "confirming";
  discoveryClosed?: boolean;
  discoveryQuestionCount?: number;
  messages: ScenarioMessage[];
  enqueueNoResponse?: boolean;
  noResponseStage?: number;
  noResponseNextAt?: string;
  meetingDeclineCount?: number;
};

export type DemoTurnSnapshot = {
  turnIndex: number;
  inbound: string;
  stage: string | null;
  offeredSlots: Array<{ label: string; startIso: string }>;
  outboundCount: number;
};

export type DemoScenario = {
  id: string;
  title: string;
  seed: DemoScenarioSeed;
  turns: Array<{ inbound: string }>;
  expectedChecks: string[];
  reviewNotes: string;
  mechanicalOnly?: boolean;
  useMockSlots?: boolean;
  meta?: { calendarFetchFailure?: boolean };
};

export type DemoScenarioBatch = {
  batchId: string;
  title: string;
  scenarios: DemoScenario[];
};

export type DemoCheckContext = {
  phone: string;
  seed: DemoScenarioSeed;
  transcript: ScenarioMessage[];
  turnSnapshots: DemoTurnSnapshot[];
  outboundBodies: string[];
  finalSession: import("~/server/speed2Lead/agent/state").AgentSession | null;
  crossFlowBlocked?: boolean;
};
