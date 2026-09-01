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

/** Two diagnostic questions already asked — next discovery question must be capped. */
export function roiDiscoveryCapSeed(firstName = "Jamie"): ScenarioSeed {
  const base = painPromptConversationSeed(firstName);
  return {
    ...base,
    stage: "discovery",
    primaryPain: "missed_calls",
    discoveryQuestionCount: 2,
    discoveryClosed: false,
    messages: [
      ...(base.messages ?? []),
      {
        role: "user",
        content: "Missed calls mostly — after hours is a mess and follow-up falls through too",
      },
      {
        role: "assistant",
        content: "When a call goes unanswered after hours, what usually happens to that job?",
      },
      {
        role: "user",
        content: "They usually go to the competitor if we don't call back the same day",
      },
      {
        role: "assistant",
        content: "What's that been costing you, would you say?",
      },
    ],
  };
}

/** Mid-scheduling seed with active offered slots (for FAQ / conflict scenarios). */
export function offeringSlotsSeed(
  firstName: string,
  offeredSlots: import("~/server/speed2Lead/agent/state").OfferedSlot[],
): ScenarioSeed {
  const base = bridgeReadySeed(firstName);
  return {
    ...base,
    stage: "offering_slots",
    offeredSlots,
    slotPool: offeredSlots,
    messages: [
      ...(base.messages ?? []),
      { role: "user", content: "Yes let's schedule" },
      {
        role: "assistant",
        content: `I have ${offeredSlots.map((s) => s.label).join(", ")} available. Which works best?`,
      },
    ],
  };
}

/** Post-booking seed — scheduling must not restart. */
export function bookedReadySeed(
  firstName: string,
  bookedStartIso: string,
  bookedEventId = "harness-booked-event",
): ScenarioSeed {
  const base = bridgeReadySeed(firstName);
  return {
    ...base,
    stage: "booked",
    bookedStartIso,
    bookedEventId,
    offeredSlots: [],
    slotPool: [],
    messages: [
      ...(base.messages ?? []),
      { role: "user", content: "Yes let's schedule" },
      { role: "assistant", content: "Great — pick a time that works." },
      { role: "user", content: "The first one works" },
      { role: "assistant", content: `[booked ${bookedStartIso}]` },
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
  session.slotPool = seed.slotPool ?? session.slotPool;
  session.bookedStartIso = seed.bookedStartIso;
  session.bookedEventId = seed.bookedEventId;
  session.requestedDate = seed.requestedDate;
  session.availabilityPreference = seed.availabilityPreference;
  session.painPromptResolved = seed.painPromptResolved;
  session.painPromptDueAt = seed.painPromptDueAt;
  session.noResponseStage = seed.noResponseStage;
  session.noResponseNextAt = seed.noResponseNextAt;
  session.noResponseResolved = seed.noResponseResolved;
  session.discoveryQuestionCount = seed.discoveryQuestionCount;
  session.discoveryClosed = seed.discoveryClosed;
  session.meetingDeclineCount = seed.meetingDeclineCount ?? 0;

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
