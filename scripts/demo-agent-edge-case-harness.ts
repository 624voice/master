#!/usr/bin/env bun
/**
 * Edge-case regression harness for the demo/Jessica Speed2Lead agent.
 *
 * Usage:
 *   bun run scripts/demo-agent-edge-case-harness.ts demo-batch-1
 *   bun run scripts/demo-agent-edge-case-harness.ts demo-batch-4 --mock-slots
 */
import twilio from "twilio";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { shouldSkipAgentOpener } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import { buildDemoBatch1 } from "~/server/speed2Lead/agent/demoFlow/testScenarios/batch-1";
import { buildDemoBatch2 } from "~/server/speed2Lead/agent/demoFlow/testScenarios/batch-2";
import { buildDemoBatch3 } from "~/server/speed2Lead/agent/demoFlow/testScenarios/batch-3";
import { buildDemoBatch4 } from "~/server/speed2Lead/agent/demoFlow/testScenarios/batch-4";
import {
  isPhoneOptedOut,
  runDemoMechanicalChecks,
} from "~/server/speed2Lead/agent/demoFlow/testScenarios/checks";
import {
  DEMO_HARNESS_PHONE,
  seedDemoAgentSession,
} from "~/server/speed2Lead/agent/demoFlow/testScenarios/seed";
import type {
  DemoCheckContext,
  DemoScenario,
  DemoScenarioBatch,
  DemoTurnSnapshot,
} from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";
import { harnessMockOfferSlots, harnessMockRawSlots } from "~/server/speed2Lead/agent/harnessMockSlots";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { setHarnessFetchFailureOverride, setHarnessOfferSlotsOverride } from "~/server/speed2Lead/agent/scheduling";
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

const DEFAULT_PHONE = DEMO_HARNESS_PHONE;
const TURN_SETTLE_MS = 4500;

const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const twilioClient = twilio(accountSid, authToken);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionToTranscript(session: AgentSession | null) {
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

function resolveBatch(batchArg: string): DemoScenarioBatch {
  if (batchArg === "demo-batch-1" || batchArg === "batch-1") return buildDemoBatch1();
  if (batchArg === "demo-batch-2" || batchArg === "batch-2") return buildDemoBatch2();
  if (batchArg === "demo-batch-3" || batchArg === "batch-3") return buildDemoBatch3();
  if (batchArg === "demo-batch-4" || batchArg === "batch-4") return buildDemoBatch4();
  throw new Error(`Unknown demo batch: ${batchArg}`);
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
    .map((m) => m.body ?? "");
}

async function runScenario(scenario: DemoScenario, globalMockSlots: boolean) {
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
  const turnSnapshots: DemoTurnSnapshot[] = [];

  try {
    if (scenario.id === "d4-cross-flow-collision") {
      let contactSession = createAgentSession({
        tenantId: getActiveProfile().tenantId,
        phone: DEFAULT_PHONE,
        flow: "contact",
        firstName: "Jamie",
        businessName: "Blocker Co",
        helpTextSummary: "missed calls",
        formMessage: "We miss calls",
        inquiryClarity: "clear",
      });
      contactSession = appendMessage(
        contactSession,
        "assistant",
        "Hey Jamie, Chris with 624Voice.",
      );
      await saveAgentSession(contactSession);
      const skip = await shouldSkipAgentOpener(DEFAULT_PHONE, "demo");
      crossFlowBlocked = skip.skip;
    } else {
      await seedDemoAgentSession(scenario.seed, DEFAULT_PHONE);
    }

    const pollSince = new Date();
    const transcript = [...scenario.seed.messages];
    let stopOptedOut = false;

    for (const [index, turn] of scenario.turns.entries()) {
      const messageSid = `SM-demo-harness-${scenario.id}-${index}-${Date.now()}`;
      await handleAgentInboundSms(DEFAULT_PHONE, turn.inbound, messageSid);
      await sleep(TURN_SETTLE_MS);

      const session = await getAgentSession(DEFAULT_PHONE);
      turnSnapshots.push({
        turnIndex: index,
        inbound: turn.inbound,
        stage: session?.stage ?? null,
        offeredSlots: session?.offeredSlots ?? [],
        outboundCount: 0,
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

    const outboundBodies = await listOutboundSince(pollSince);
    const session = await getAgentSession(DEFAULT_PHONE);

    const ctx: DemoCheckContext = {
      phone: DEFAULT_PHONE,
      seed: scenario.seed,
      transcript,
      turnSnapshots,
      outboundBodies,
      finalSession: session,
      crossFlowBlocked,
    };

    const mechanicalChecks: Record<string, { pass: boolean; detail: string }> = {};
    for (const checkId of scenario.expectedChecks) {
      if (checkId === "stopOptedOut") {
        mechanicalChecks[checkId] = {
          pass: stopOptedOut,
          detail: stopOptedOut ? "opted out" : "not opted out",
        };
      } else {
        mechanicalChecks[checkId] = runDemoMechanicalChecks(checkId, ctx);
      }
    }

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
      "Usage: bun run scripts/demo-agent-edge-case-harness.ts demo-batch-1|2|3|4 [--scenario id] [--mock-slots]",
    );
    process.exit(1);
  }

  process.env.SPEED2LEAD_DEMO_AGENT_V2 = "true";

  const batch = resolveBatch(batchArg);
  const scenarios = scenarioFilter
    ? batch.scenarios.filter((s) => s.id === scenarioFilter)
    : batch.scenarios;

  if (scenarios.length === 0) {
    console.error(`No scenarios matched filter: ${scenarioFilter}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ batchId: batch.batchId, title: batch.title, count: scenarios.length, mockSlots }, null, 2));

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
