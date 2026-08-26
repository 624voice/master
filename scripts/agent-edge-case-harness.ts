#!/usr/bin/env bun
/**
 * Generic edge-case regression harness for Speed2Lead-style SMS agents.
 *
 * Usage:
 *   bun run scripts/agent-edge-case-harness.ts batch-1
 *   bun run scripts/agent-edge-case-harness.ts src/server/speed2Lead/agent/testScenarios/batch-1.ts
 *   bun run scripts/agent-edge-case-harness.ts batch-1 --scenario 1-not-sure
 *
 * Execution path: direct `handleAgentInboundSms()` against shared Upstash Redis +
 * Twilio (same infrastructure as preview-81). Outbound SMS are real Twilio sends to
 * the allowlisted test handset (+12149722278 only).
 */
import twilio from "twilio";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { processPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { processPendingPainPrompts } from "~/server/speed2Lead/agent/painPrompt";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  runMechanicalChecks,
  summarizeChecks,
  type CheckContext,
  type TurnSnapshot,
} from "~/server/speed2Lead/agent/testScenarios/checks";
import {
  HARNESS_TEST_PHONE,
  seedAgentSession,
} from "~/server/speed2Lead/agent/testScenarios/seed";
import type { AgentScenario, ScenarioBatch, ScenarioMessage } from "~/server/speed2Lead/agent/testScenarios/types";
import {
  clearAgentSession,
  getAgentSession,
  saveAgentSession,
} from "~/server/speed2Lead/agent/state";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";
import { clearOptedOut } from "~/server/speed2Lead/session";
import { normalizePhone } from "~/server/sms/phone";

const DEFAULT_PHONE = HARNESS_TEST_PHONE;
const TURN_SETTLE_MS = 4500;

type OutboundSms = { sid: string; body: string; sentAt: string | null };

type ScenarioReport = {
  id: string;
  title: string;
  pass: boolean;
  mechanicalChecks: Record<string, { pass: boolean; detail: string }>;
  failedChecks: string[];
  transcript: ScenarioMessage[];
  turnSnapshots: Array<{
    turnIndex: number;
    inbound: string;
    stage: string | null;
    offeredSlots: Array<{ label: string; startIso: string }>;
    outboundCount: number;
  }>;
  finalSession: Record<string, unknown> | null;
  reviewNotes: string;
  execution: {
    path: "direct_handleAgentInboundSms";
    phone: string;
    tenantId: string;
    referenceIso: string;
  };
  cronAfterStop?: { painSent: number; noResponseSent: number };
};

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

async function resolveBatchModule(batchArg: string): Promise<{ batch: ScenarioBatch; modulePath: string }> {
  const candidates = batchArg.endsWith(".ts")
    ? [path.resolve(batchArg)]
    : [
        path.resolve(`src/server/speed2Lead/agent/testScenarios/${batchArg}.ts`),
        path.resolve(`src/server/speed2Lead/agent/testScenarios/${batchArg}.tsx`),
      ];

  let lastError: unknown;
  for (const modulePath of candidates) {
    try {
      const mod = await import(pathToFileURL(modulePath).href);
      const batch: ScenarioBatch =
        typeof mod.buildBatch1 === "function"
          ? mod.buildBatch1(new Date())
          : mod.batch1 ?? mod.default;
      if (!batch?.scenarios?.length) {
        throw new Error(`No scenarios exported from ${modulePath}`);
      }
      return { batch, modulePath };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Could not load batch module for "${batchArg}"`);
}

function sessionToTranscript(session: Awaited<ReturnType<typeof getAgentSession>>): ScenarioMessage[] {
  if (!session) return [];
  return session.messages.map((m) => ({ role: m.role, content: m.content }));
}

function buildTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required");
  }
  return {
    client: twilio(accountSid, authToken),
    fromNumber,
  };
}

async function listOutboundSince(
  client: twilio.Twilio,
  fromNumber: string,
  phone: string,
  since: Date,
): Promise<OutboundSms[]> {
  const messages = await client.messages.list({
    to: normalizePhone(phone),
    from: normalizePhone(fromNumber),
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

async function resetHarnessPhone(phone: string) {
  if (phone !== DEFAULT_PHONE) {
    throw new Error(`Harness only supports test handset ${DEFAULT_PHONE}`);
  }
  await resetSpeed2LeadTestPhone(phone);
  await clearAgentSession(phone);
  await clearOptedOut(phone);
}

async function exerciseCronsAfterStop(phone: string): Promise<{ painSent: number; noResponseSent: number }> {
  const session = await getAgentSession(phone);
  if (session) {
    const past = new Date(Date.now() - 60_000).toISOString();
    await saveAgentSession({
      ...session,
      painPromptDueAt: past,
      painPromptResolved: false,
      noResponseNextAt: past,
      noResponseStage: session.noResponseStage ?? 0,
      noResponseResolved: false,
    });
  }
  const painSent = await processPendingPainPrompts();
  const noResponseSent = await processPendingNoResponseCampaign();
  return { painSent, noResponseSent };
}

async function runScenario(
  scenario: AgentScenario,
  phone: string,
  twilioCtx: ReturnType<typeof buildTwilioClient>,
): Promise<ScenarioReport> {
  await resetHarnessPhone(phone);

  const runStartedAt = new Date();
  const referenceIso = (scenario.meta?.referenceIso as string) ?? runStartedAt.toISOString();

  await seedAgentSession(scenario.seed, phone);

  const turnSnapshots: TurnSnapshot[] = [];
  let stopAt: string | undefined;

  for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
    const turn = scenario.turns[turnIndex]!;
    if (turn.delayMs) {
      await sleep(turn.delayMs);
    }

    if (turn.inbound.trim().toUpperCase() === "STOP") {
      stopAt = new Date().toISOString();
    }

    const messageSid = `SM-harness-${scenario.id}-${turnIndex}-${Date.now()}`;
    await handleAgentInboundSms(phone, turn.inbound, messageSid);
    await sleep(TURN_SETTLE_MS);

    const session = await getAgentSession(phone);
    const outboundSinceStart = await listOutboundSince(
      twilioCtx.client,
      twilioCtx.fromNumber,
      phone,
      runStartedAt,
    );

    turnSnapshots.push({
      turnIndex,
      inbound: turn.inbound,
      session,
      transcript: sessionToTranscript(session),
      outboundSms: outboundSinceStart,
    });
  }

  let cronAfterStop: ScenarioReport["cronAfterStop"];
  if (scenario.meta?.exerciseCronsAfterStop) {
    cronAfterStop = await exerciseCronsAfterStop(phone);
    await sleep(2000);
  }

  const finalSession = await getAgentSession(phone);
  const outboundSinceStart = await listOutboundSince(
    twilioCtx.client,
    twilioCtx.fromNumber,
    phone,
    runStartedAt,
  );

  const checkCtx: CheckContext = {
    phone,
    session: finalSession,
    transcript: sessionToTranscript(finalSession),
    turnSnapshots,
    meta: {
      ...scenario.meta,
      referenceIso,
      timezone: scenario.meta?.timezone ?? getActiveProfile().timezone,
    },
    outboundSinceStart,
    stopAt,
  };

  const mechanicalChecks = await runMechanicalChecks(scenario.expectedChecks, checkCtx);
  const summary = summarizeChecks(mechanicalChecks);

  if (cronAfterStop && (cronAfterStop.painSent > 0 || cronAfterStop.noResponseSent > 0)) {
    summary.pass = false;
    summary.failed.push(
      `cronAfterStop: painSent=${cronAfterStop.painSent}, noResponseSent=${cronAfterStop.noResponseSent}`,
    );
  }

  return {
    id: scenario.id,
    title: scenario.title,
    pass: summary.pass,
    mechanicalChecks,
    failedChecks: summary.failed,
    transcript: checkCtx.transcript,
    turnSnapshots: turnSnapshots.map((snap) => ({
      turnIndex: snap.turnIndex,
      inbound: snap.inbound,
      stage: snap.session?.stage ?? null,
      offeredSlots: (snap.session?.offeredSlots ?? []).map((s) => ({
        label: s.label,
        startIso: s.startIso,
      })),
      outboundCount: snap.outboundSms.length,
    })),
    finalSession: finalSession
      ? {
          stage: finalSession.stage,
          primaryPain: finalSession.primaryPain,
          offeredSlots: finalSession.offeredSlots,
          painPromptResolved: finalSession.painPromptResolved,
          painPromptDueAt: finalSession.painPromptDueAt,
          noResponseStage: finalSession.noResponseStage,
          noResponseNextAt: finalSession.noResponseNextAt,
          noResponseResolved: finalSession.noResponseResolved,
          bookedStartIso: finalSession.bookedStartIso,
        }
      : null,
    reviewNotes: scenario.reviewNotes,
    execution: {
      path: "direct_handleAgentInboundSms",
      phone,
      tenantId: getActiveProfile().tenantId,
      referenceIso,
    },
    cronAfterStop,
  };
}

async function main() {
  const { batchArg, scenarioFilter } = parseArgs(process.argv.slice(2));
  if (!batchArg) {
    console.error("Usage: bun run scripts/agent-edge-case-harness.ts <batch-file> [--scenario <id>]");
    process.exit(1);
  }

  const twilioCtx = buildTwilioClient();
  const { batch, modulePath } = await resolveBatchModule(batchArg);
  const phone = DEFAULT_PHONE;

  console.log(
    JSON.stringify(
      {
        harness: "agent-edge-case",
        batchId: batch.batchId,
        batchTitle: batch.title,
        modulePath,
        phone,
        executionPath: "direct_handleAgentInboundSms",
        scenarioCount: batch.scenarios.length,
        filter: scenarioFilter ?? null,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const selected = scenarioFilter
    ? batch.scenarios.filter((s) => s.id === scenarioFilter || s.id.startsWith(scenarioFilter))
    : batch.scenarios;

  if (selected.length === 0) {
    throw new Error(`No scenarios matched filter: ${scenarioFilter}`);
  }

  const reports: ScenarioReport[] = [];
  for (const scenario of selected) {
    console.log(`\n--- Running ${scenario.id}: ${scenario.title} ---`);
    const report = await runScenario(scenario, phone, twilioCtx);
    reports.push(report);
    console.log(JSON.stringify(report, null, 2));
  }

  const batchPass = reports.every((r) => r.pass);
  console.log(
    "\n========== BATCH SUMMARY ==========",
    JSON.stringify(
      {
        batchId: batch.batchId,
        pass: batchPass,
        scenarios: reports.map((r) => ({ id: r.id, pass: r.pass, failedChecks: r.failedChecks })),
        finishedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (!batchPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
