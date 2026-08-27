import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  buildContactNoResponseMessage1Clear,
  buildContactNoResponseMessage1Vague,
} from "~/server/speed2Lead/agent/contactFlow/noResponseCampaign";
import {
  buildAlreadyClearOpener,
  buildClearNeedOpener,
  buildVagueInquiryOpener,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import {
  appendMessage,
  createAgentSession,
  enqueueNoResponseCampaign,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import type { InquiryClarity, ScenarioMessage, ScenarioSeed } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";

export const CONTACT_HARNESS_PHONE = "+12149722278";

export function contactSeed(
  clarity: InquiryClarity,
  formMessage: string,
  helpTextSummary: string,
  firstName = "Alex",
): ScenarioSeed {
  const session = createAgentSession({
    tenantId: getActiveProfile().tenantId,
    phone: CONTACT_HARNESS_PHONE,
    flow: "contact",
    firstName,
    businessName: "Test Plumbing",
    trade: "Plumbing",
    fleetSize: "2",
    websiteStatus: "has",
    helpTextSummary,
    formMessage,
    inquiryClarity: clarity,
  });

  const opener =
    clarity === "already_clear"
      ? buildAlreadyClearOpener(session)
      : clarity === "vague"
        ? buildVagueInquiryOpener(session)
        : buildClearNeedOpener(session);

  return {
    flow: "contact",
    inquiryClarity: clarity,
    helpTextSummary,
    formMessage,
    firstName,
    businessName: "Test Plumbing",
    trade: "Plumbing",
    fleetSize: "2",
    discoveryClosed: clarity === "already_clear",
    stage: clarity === "already_clear" ? "bridge" : "discovery",
    messages: [{ role: "assistant", content: opener }],
  };
}

export async function seedContactAgentSession(
  seed: ScenarioSeed,
  phone = CONTACT_HARNESS_PHONE,
): Promise<AgentSession> {
  let session = createAgentSession({
    tenantId: getActiveProfile().tenantId,
    phone,
    flow: "contact",
    firstName: seed.firstName,
    businessName: seed.businessName,
    trade: seed.trade,
    fleetSize: seed.fleetSize,
    websiteStatus: seed.websiteStatus,
    helpTextSummary: seed.helpTextSummary,
    formMessage: seed.formMessage,
    inquiryClarity: seed.inquiryClarity,
  });

  session.stage = seed.stage ?? session.stage;
  session.discoveryClosed = seed.discoveryClosed ?? session.discoveryClosed;
  session.discoveryQuestionCount = seed.discoveryQuestionCount ?? session.discoveryQuestionCount;
  session.primaryPain = seed.primaryPain;
  session.offeredSlots = seed.offeredSlots ?? session.offeredSlots;
  session.noResponseStage = seed.noResponseStage;
  session.noResponseNextAt = seed.noResponseNextAt;
  session.noResponseResolved = seed.noResponseResolved;

  for (const message of seed.messages ?? []) {
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

export function expectedNoResponseDay1(session: AgentSession): string {
  const profile = getActiveProfile();
  if (session.inquiryClarity === "vague") {
    return buildContactNoResponseMessage1Vague(profile, session);
  }
  return buildContactNoResponseMessage1Clear(profile, session);
}

export type { ScenarioMessage };
