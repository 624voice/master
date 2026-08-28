#!/usr/bin/env bun
/**
 * Edge-case regression harness for the contact-form Speed2Lead agent.
 *
 * Usage:
 *   bun run scripts/contact-agent-edge-case-harness.ts contact-batch-1
 *   bun run scripts/contact-agent-edge-case-harness.ts contact-batch-2 --scenario c10-discovery-cap-enforced
 *   bun run scripts/contact-agent-edge-case-harness.ts contact-batch-4 --mock-slots
 */
import twilio from "twilio";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { shouldSkipAgentOpener } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import { harnessMockOfferSlots, harnessMockRawSlots } from "~/server/speed2Lead/agent/harnessMockSlots";
import { isPhoneOptedOut, runContactMechanicalChecks } from "~/server/speed2Lead/agent/contactFlow/testScenarios/checks";
import { buildContactBatch1 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-1";
import { buildContactBatch2 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-2";
import { buildContactBatch3 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-3";
import { buildContactBatch4 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-4";
import { buildContactBatch5 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-5";
import {
  CONTACT_HARNESS_PHONE,
  seedContactAgentSession,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import type {
  ContactCheckContext,
  ContactScenario,
  ContactScenarioBatch,
  ContactTurnSnapshot,
  ScenarioMessage,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { setHarnessFetchFailureOverride, setHarnessOfferSlotsOverride } from "~/server/speed2Lead/agent/scheduling";
import { buildOpenerMessage1 } from "~/server/speed2Lead/agent/painPrompt";
import {
  appendMessage,
  clearAgentSession,
  createAgentSession,
  getAgentSession,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";
import { clearOptedOut } from "~/server/speed2Lead/session";

const DEFAULT_PHONE = CONTACT_HARNESS_PHONE;
const TURN_SETTLE_MS = 4500;

const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const twilioClient = twilio(accountSid, authToken);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionToTranscript(session: AgentSession | null): ScenarioMessage[] {
  return session?.messages ?? [];
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let scenarioFilter: string | undefined;
  let mockSlots = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--scenario" && argv[i + 1]) {
      scenarioFilter = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--mock-slots") {
      mockSlots = true;
    } else {
      positional.push(argv[i]!);
    }
  }
  return { batchArg: positional[0], scenarioFilter, mockSlots };
}

function resolveBatch(batchArg: string): ContactScenarioBatch {
  if (batchArg === "contact-batch-1" || batchArg === "batch-1") {
    return buildContactBatch1();
  }
  if (batchArg === "contact-batch-2" || batchArg === "batch-2") {
    return buildContactBatch2();
  }
  if (batchArg === "contact-batch-3" || batchArg === "batch-3") {
    return buildContactBatch3();
  }
  if (batchArg === "contact-batch-4" || batchArg === "batch-4") {
    return buildContactBatch4();
  }
  if (batchArg === "contact-batch-5" || batchArg === "batch-5") {
    return buildContactBatch5();
  }
  throw new Error(`Unknown contact batch: ${batchArg}`);
}

async function resetHarnessPhone(phone = DEFAULT_PHONE) {
  await resetSpeed2LeadTestPhone(phone);
  await clearAgentSession(phone);
  await clearOptedOut(phone);
}

async function listOutboundSince(since: Date, phone = DEFAULT_PHONE) {
  const messages = await twilioClient.messages.list({
    to: phone,
    from: fromNumber,
    dateSentAfter: since,
    limit: 30,
  });
  return messages
    .filter((m) => m.direction.startsWith("outbound"))
    .sort((a, b) => (a.dateSent?.getTime() ?? 0) - (b.dateSent?.getTime() ?? 0))
    .map((m) => ({
      sid: m.sid,
      body: m.body ?? "",
      sentAt: m.dateSent?.toISOString() ?? null,
    }));
}

async function runScenario(
  scenario: ContactScenario,
  globalMockSlots: boolean,
): Promise<{
  id: string;
  pass: boolean;
  failedChecks: string[];
  mechanicalChecks: Record<string, { pass: boolean; detail: string }>;
}> {
  await resetHarnessPhone();

  const useMockSlots = globalMockSlots || scenario.useMockSlots === true;
  if (useMockSlots) {
    setHarnessOfferSlotsOverride(
      () => harnessMockOfferSlots(getActiveProfile()),
      () => harnessMockRawSlots(getActiveProfile()),
    );
  } else {
    setHarnessOfferSlotsOverride(null);
  }

  if (scenario.meta?.calendarFetchFailure === true && useMockSlots) {
    setHarnessFetchFailureOverride(() => ({ ok: false, reason: "harness_calendar_api_error" }));
  } else {
    setHarnessFetchFailureOverride(null);
  }

  let crossFlowBlocked = false;
  const turnSnapshots: ContactTurnSnapshot[] = [];

  try {
    if (scenario.id === "c5-cross-flow-collision") {
      const profile = getActiveProfile();
      let roiSession = createAgentSession({
        tenantId: profile.tenantId,
        phone: DEFAULT_PHONE,
        flow: "roi",
        firstName: "Jamie",
        businessName: "ROI Blocker Co",
        annualOpportunity: "$100,000",
        primaryOpportunity: "Missed calls",
        reportUrl: "https://624voice.com/report/block",
      });
      const opener = buildOpenerMessage1(profile, {
        firstName: "Jamie",
        businessName: "ROI Blocker Co",
        annualOpportunity: "$100,000",
      });
      roiSession = appendMessage(roiSession, "assistant", opener);
      await saveAgentSession(roiSession);
      const skip = await shouldSkipAgentOpener(DEFAULT_PHONE, "contact");
      crossFlowBlocked = skip.skip;
    } else if (scenario.id === "c24-resubmit-while-active") {
      await seedContactAgentSession(scenario.seed, DEFAULT_PHONE);
      const skip = await shouldSkipAgentOpener(DEFAULT_PHONE, "contact");
      crossFlowBlocked = skip.skip;
    } else {
      await seedContactAgentSession(scenario.seed, DEFAULT_PHONE);
    }

    const pollSince = new Date();
    const transcript: ContactCheckContext["transcript"] = [...(scenario.seed.messages ?? [])];
    let stopAt: Date | undefined;
    let stopOptedOut = false;

    for (const [index, turn] of scenario.turns.entries()) {
      if (turn.delayMs) await sleep(turn.delayMs);
      if (turn.inbound.trim().toUpperCase() === "STOP") {
        stopAt = new Date();
      }
      const messageSid = `SM-contact-harness-${scenario.id}-${index}-${Date.now()}`;
      await handleAgentInboundSms(DEFAULT_PHONE, turn.inbound, messageSid);
      await sleep(TURN_SETTLE_MS);

      const session = await getAgentSession(DEFAULT_PHONE);
      turnSnapshots.push({
        turnIndex: index,
        inbound: turn.inbound,
        session,
        transcript: sessionToTranscript(session),
      });

      transcript.push({ role: "user", content: turn.inbound });
      const lastAssistant = session?.messages.filter((m) => m.role === "assistant").at(-1);
      if (lastAssistant) {
        transcript.push({ role: "assistant", content: lastAssistant.content });
      }
    }

    if (scenario.turns.some((t) => t.inbound.trim().toUpperCase() === "STOP")) {
      stopOptedOut = await isPhoneOptedOut(DEFAULT_PHONE);
    }

    const outboundSinceStart = await listOutboundSince(pollSince);
    const outboundAfterStop = stopAt ? await listOutboundSince(stopAt) : [];

    const session = await getAgentSession(DEFAULT_PHONE);
    const ctx: ContactCheckContext = {
      phone: DEFAULT_PHONE,
      seed: scenario.seed,
      session,
      transcript,
      turnSnapshots,
      outboundSinceStart,
      stopOptedOut,
      outboundAfterStop,
      crossFlowBlocked,
      meta: scenario.meta,
    };

    const mechanicalChecks = await runContactMechanicalChecks(scenario.expectedChecks, ctx);
    const failedChecks = Object.entries(mechanicalChecks)
      .filter(([, result]) => !result.pass)
      .map(([name]) => name);

    return {
      id: scenario.id,
      pass: failedChecks.length === 0,
      failedChecks,
      mechanicalChecks,
    };
  } finally {
    setHarnessOfferSlotsOverride(null);
    setHarnessFetchFailureOverride(null);
  }
}

async function main() {
  const { batchArg, scenarioFilter, mockSlots } = parseArgs(process.argv.slice(2));
  if (!batchArg) {
    console.error(
      "Usage: bun run scripts/contact-agent-edge-case-harness.ts contact-batch-1|2|3|4|5 [--scenario id] [--mock-slots]",
    );
    process.exit(1);
  }

  process.env.SPEED2LEAD_CONTACT_AGENT_V2 = "true";

  const batch = resolveBatch(batchArg);
  const scenarios = scenarioFilter
    ? batch.scenarios.filter((s) => s.id === scenarioFilter)
    : batch.scenarios;

  if (scenarios.length === 0) {
    console.error(`No scenarios matched filter: ${scenarioFilter}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      { batchId: batch.batchId, title: batch.title, count: scenarios.length, mockSlots },
      null,
      2,
    ),
  );

  const results = [];
  for (const scenario of scenarios) {
    console.log(`\n--- Running ${scenario.id}: ${scenario.title} ---`);
    const result = await runScenario(scenario, mockSlots);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const summary = {
    batchId: batch.batchId,
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results: results.map((r) => ({ id: r.id, pass: r.pass, failedChecks: r.failedChecks })),
  };

  console.log("\n========== BATCH SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
