import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";

export type ScenarioMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ScenarioSeed = {
  stage?: AgentSession["stage"];
  firstName?: string;
  businessName?: string;
  email?: string;
  annualOpportunity?: string;
  primaryOpportunity?: string;
  reportUrl?: string;
  primaryPain?: string;
  offeredSlots?: OfferedSlot[];
  slotPool?: OfferedSlot[];
  bookedStartIso?: string;
  bookedEventId?: string;
  requestedDate?: string;
  availabilityPreference?: import("~/server/scheduling/types").AvailabilityPreference;
  messages?: ScenarioMessage[];
  painPromptResolved?: boolean;
  painPromptDueAt?: string;
  noResponseStage?: number;
  noResponseNextAt?: string;
  noResponseResolved?: boolean;
  /** Enqueue phone on pain-prompt Redis index after seeding. */
  enqueuePainPrompt?: boolean;
  /** Enqueue phone on no-response Redis index after seeding. */
  enqueueNoResponse?: boolean;
};

export type ScenarioTurn = {
  inbound: string;
  delayMs?: number;
};

export type AgentScenario = {
  id: string;
  title: string;
  seed: ScenarioSeed;
  turns: ScenarioTurn[];
  expectedChecks: string[];
  reviewNotes: string;
  /** Optional parameters for date/daypart checks (computed at runtime when absent). */
  meta?: Record<string, unknown>;
  /** When true, harness injects deterministic mock calendar slots (local runs). */
  useMockSlots?: boolean;
  /** `local` = direct handleAgentInboundSms; `preview` = signed HTTP to preview deploy. */
  execution?: "local" | "preview";
};

export type ScenarioBatch = {
  batchId: string;
  title: string;
  profileTenantId?: string;
  scenarios: AgentScenario[];
};
