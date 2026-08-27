import { buildDemoOpenerPart1 } from "~/server/speed2Lead/agent/demoFlow/openers";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  appendMessage,
  createAgentSession,
  enqueueNoResponseCampaign,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import type { DemoCallOutcome, DemoSummary } from "~/server/speed2Lead/agent/demoFlow/types";
import type { DemoScenarioSeed } from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";

export const DEMO_HARNESS_PHONE = "+12149722278";

export function demoSeed(input: {
  callOutcome?: DemoCallOutcome;
  callDurationSeconds?: number;
  demoSummary?: DemoSummary | null;
  firstName?: string;
  businessName?: string;
}): DemoScenarioSeed {
  const callOutcome = input.callOutcome ?? "full";
  const session = createAgentSession({
    tenantId: getActiveProfile().tenantId,
    phone: DEMO_HARNESS_PHONE,
    flow: "demo",
    firstName: input.firstName ?? "Alex",
    businessName: input.businessName ?? "Test Plumbing",
    email: "alex@testplumbing.com",
  });

  const withDemo = {
    ...session,
    callOutcome,
    callDurationSeconds: input.callDurationSeconds ?? (callOutcome === "short" ? 30 : 120),
    demoSummary: input.demoSummary ?? null,
    vapiCallId: "harness-call-id",
  };

  const opener = buildDemoOpenerPart1(withDemo);

  return {
    flow: "demo",
    firstName: input.firstName ?? "Alex",
    businessName: input.businessName ?? "Test Plumbing",
    callOutcome,
    callDurationSeconds: withDemo.callDurationSeconds ?? 120,
    demoSummary: input.demoSummary ?? null,
    vapiCallId: "harness-call-id",
    stage: "discovery",
    messages: [{ role: "assistant", content: opener }],
  };
}

export async function seedDemoAgentSession(
  seed: DemoScenarioSeed,
  phone = DEMO_HARNESS_PHONE,
): Promise<AgentSession> {
  let session = createAgentSession({
    tenantId: getActiveProfile().tenantId,
    phone,
    flow: "demo",
    firstName: seed.firstName,
    businessName: seed.businessName,
    email: "alex@testplumbing.com",
    vapiCallId: seed.vapiCallId,
    callDurationSeconds: seed.callDurationSeconds,
    callOutcome: seed.callOutcome,
    demoSummary: seed.demoSummary,
  });

  session.stage = seed.stage ?? "discovery";
  session.discoveryClosed = seed.discoveryClosed ?? false;
  session.discoveryQuestionCount = seed.discoveryQuestionCount ?? 0;
  session.meetingDeclineCount = seed.meetingDeclineCount ?? 0;

  for (const message of seed.messages) {
    session = appendMessage(session, message.role, message.content);
  }

  if (seed.enqueueNoResponse) {
    const profile = getActiveProfile();
    session.noResponseStage = seed.noResponseStage ?? 0;
    session.noResponseResolved = false;
    session.noResponseNextAt =
      seed.noResponseNextAt ??
      new Date(new Date(session.createdAt).getTime() + profile.noResponseDelaysMinutes[0]! * 60_000).toISOString();
    await enqueueNoResponseCampaign(phone);
  }

  await saveAgentSession(session);
  return session;
}
