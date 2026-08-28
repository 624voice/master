import type { AgentSession, InquiryClarity } from "~/server/speed2Lead/agent/state";
import type { OfferedSlot } from "~/server/speed2Lead/agent/state";
import type { ScenarioMessage, ScenarioSeed as BaseScenarioSeed } from "~/server/speed2Lead/agent/testScenarios/types";

export type { ScenarioMessage };

export type ScenarioSeed = BaseScenarioSeed & {
  flow?: "contact";
  inquiryClarity?: InquiryClarity;
  helpTextSummary?: string;
  formMessage?: string;
  trade?: string;
  fleetSize?: string;
  websiteStatus?: "has" | "none";
  discoveryClosed?: boolean;
  discoveryQuestionCount?: number;
  requestedDate?: string;
  availabilityPreference?: import("~/server/speed2Lead/agent/scheduling/types").AvailabilityPreference;
  slotPool?: OfferedSlot[];
};

export type ContactTurnSnapshot = {
  turnIndex: number;
  inbound: string;
  session: AgentSession | null;
  transcript: ScenarioMessage[];
};

export type ContactScenario = {
  id: string;
  title: string;
  seed: ScenarioSeed;
  turns: Array<{ inbound: string; delayMs?: number }>;
  expectedChecks: string[];
  reviewNotes: string;
  useMockSlots?: boolean;
  /** Mechanical-only scenarios skip LLM turns. */
  mechanicalOnly?: boolean;
  meta?: Record<string, unknown>;
};

export type ContactScenarioBatch = {
  batchId: string;
  title: string;
  scenarios: ContactScenario[];
};

export type ContactCheckContext = {
  phone: string;
  seed: ScenarioSeed;
  session: AgentSession | null;
  transcript: ScenarioMessage[];
  turnSnapshots: ContactTurnSnapshot[];
  outboundSinceStart: Array<{ sid: string; body: string; sentAt: string | null }>;
  stopOptedOut?: boolean;
  outboundAfterStop?: Array<{ sid: string; body: string; sentAt: string | null }>;
  crossFlowBlocked?: boolean;
  meta?: Record<string, unknown>;
};
