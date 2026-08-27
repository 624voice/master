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
  outboundSinceStart: Array<{ sid: string; body: string; sentAt: string | null }>;
  stopOptedOut?: boolean;
  outboundAfterStop?: Array<{ sid: string; body: string; sentAt: string | null }>;
  crossFlowBlocked?: boolean;
};
