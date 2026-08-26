import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  buildOpenerMessage1,
  buildPainPromptMessage,
  schedulePainPrompt,
} from "~/server/speed2Lead/agent/painPrompt";
import { scheduleNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import {
  appendMessage,
  createAgentSession,
  enqueuePainPrompt,
  enqueueNoResponseCampaign,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import type { ScenarioSeed } from "~/server/speed2Lead/agent/testScenarios/types";

export const HARNESS_TEST_PHONE = "+12149722278";

export function defaultOpenerSeed(firstName = "Jamie", businessName = "Harness Test Co"): ScenarioSeed {
  const profile = getActiveProfile();
  return {
    firstName,
    businessName,
    email: "harness@example.com",
    annualOpportunity: "$118,500",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/harness",
    messages: [
      {
        role: "assistant",
        content: buildOpenerMessage1(profile, {
          firstName,
          businessName,
          annualOpportunity: "$118,500",
        }),
      },
    ],
  };
}

export function painPromptConversationSeed(firstName = "Jamie"): ScenarioSeed {
  const profile = getActiveProfile();
  const base = defaultOpenerSeed(firstName);
  const painPrompt = buildPainPromptMessage(profile);
  return {
    ...base,
    painPromptResolved: true,
    messages: [
      ...(base.messages ?? []),
      { role: "assistant", content: painPrompt },
    ],
  };
}

export function stopTestSeed(firstName = "Jamie"): ScenarioSeed {
  return {
    ...defaultOpenerSeed(firstName),
    enqueuePainPrompt: true,
    enqueueNoResponse: true,
  };
}

export function bridgeReadySeed(firstName = "Jamie"): ScenarioSeed {
  const profile = getActiveProfile();
  const base = painPromptConversationSeed(firstName);
  return {
    ...base,
    stage: "bridge",
    primaryPain: "missed_calls",
    messages: [
      ...(base.messages ?? []),
      { role: "user", content: "Missed calls mostly" },
      {
        role: "assistant",
        content:
          "Got it — missed calls can add up fast. If I could show you a way to respond faster and book more of those jobs without adding headcount, would it be worth 25 minutes to see how it works?",
      },
    ],
  };
}

export async function seedAgentSession(seed: ScenarioSeed, phone = HARNESS_TEST_PHONE): Promise<AgentSession> {
  const profile = getActiveProfile();
  let session = createAgentSession({
    tenantId: profile.tenantId,
    phone,
    firstName: seed.firstName,
    businessName: seed.businessName,
    email: seed.email,
    annualOpportunity: seed.annualOpportunity,
    primaryOpportunity: seed.primaryOpportunity,
    reportUrl: seed.reportUrl,
  });

  session.stage = seed.stage ?? session.stage;
  session.primaryPain = seed.primaryPain;
  session.offeredSlots = seed.offeredSlots ?? session.offeredSlots;
  session.painPromptResolved = seed.painPromptResolved;
  session.painPromptDueAt = seed.painPromptDueAt;
  session.noResponseStage = seed.noResponseStage;
  session.noResponseNextAt = seed.noResponseNextAt;
  session.noResponseResolved = seed.noResponseResolved;
  session.meetingDeclineCount = 0;

  for (const message of seed.messages ?? []) {
    session = appendMessage(session, message.role, message.content);
  }

  if (seed.enqueuePainPrompt) {
    session = await schedulePainPrompt(session, profile);
  }
  if (seed.enqueueNoResponse) {
    session = await scheduleNoResponseCampaign(session, profile);
  }

  await saveAgentSession(session);

  if (seed.enqueuePainPrompt) {
    await enqueuePainPrompt(phone);
  }
  if (seed.enqueueNoResponse) {
    await enqueueNoResponseCampaign(phone);
  }

  return session;
}
