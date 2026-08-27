#!/usr/bin/env bun
/**
 * Edge-case regression harness for the contact-form Speed2Lead agent.
 *
 * Usage:
 *   bun run scripts/contact-agent-edge-case-harness.ts contact-batch-1
 *   bun run scripts/contact-agent-edge-case-harness.ts contact-batch-1 --scenario c4-stop
 */
import twilio from "twilio";
import path from "node:path";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { shouldSkipAgentOpener } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import { isPhoneOptedOut, runContactMechanicalChecks } from "~/server/speed2Lead/agent/contactFlow/testScenarios/checks";
import { buildContactBatch1 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/batch-1";
import {
  CONTACT_HARNESS_PHONE,
  seedContactAgentSession,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import type {
  ContactCheckContext,
  ContactScenario,
  ContactScenarioBatch,
} from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import {
  clearAgentSession,
  getAgentSession,
  saveAgentSession,
  createAgentSession,
  appendMessage,
} from "~/server/speed2Lead/agent/state";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { buildOpenerMessage1 } from "~/server/speed2Lead/agent/painPrompt";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";
import { clearOptedOut } from "~/server/speed2Lead/session";

const DEFAULT_PHONE = CONTACT_HARNESS_PHONE;
const TURN_SETTLE_MS = 3500;

const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const twilioClient = twilio(accountSid, authToken);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let scenarioFilter: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--scenario" && argv[i + 1]) {
      scenarioFilter = argv[i + 1];
      i += 1;
    } else {
      positional.push(argv[i]!);
    }
  }
  return { batchArg: positional[0], scenarioFilter };
}

function resolveBatch(batchArg: string): ContactScenarioBatch {
  if (batchArg === "contact-batch-1" || batchArg === "batch-1") {
    return buildContactBatch1();
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
    limit: 20,
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

async function runScenario(scenario: ContactScenario): Promise<{
  id: string;
  pass: boolean;
  failedChecks: string[];
  mechanicalChecks: Record<string, { pass: boolean; detail: string }>;
}> {
  await resetHarnessPhone();

  let crossFlowBlocked = false;
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
    transcript.push({ role: "user", content: turn.inbound });
    const session = await getAgentSession(DEFAULT_PHONE);
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
    outboundSinceStart,
    stopOptedOut,
    outboundAfterStop,
    crossFlowBlocked,
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
}

async function main() {
  const { batchArg, scenarioFilter } = parseArgs(process.argv.slice(2));
  if (!batchArg) {
    console.error("Usage: bun run scripts/contact-agent-edge-case-harness.ts contact-batch-1");
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

  console.log(JSON.stringify({ batchId: batch.batchId, title: batch.title, count: scenarios.length }, null, 2));

  const results = [];
  for (const scenario of scenarios) {
    console.log(`\n--- Running ${scenario.id}: ${scenario.title} ---`);
    const result = await runScenario(scenario);
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
