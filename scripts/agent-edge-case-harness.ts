#!/usr/bin/env bun
/**
 * Generic edge-case regression harness for Speed2Lead-style SMS agents.
 *
 * Usage:
 *   bun run scripts/agent-edge-case-harness.ts batch-1
 *   bun run scripts/agent-edge-case-harness.ts src/server/speed2Lead/agent/testScenarios/batch-1.ts
 *   bun run scripts/agent-edge-case-harness.ts batch-1 --scenario 1-not-sure
 *
 *   bun run scripts/agent-edge-case-harness.ts batch-1 --mock-slots
 *
 * Execution paths:
 * - local (default): direct handleAgentInboundSms against shared Redis/Twilio
 * - preview: signed POST to S2L_PREVIEW_URL (scenarios with execution: "preview")
 * - --mock-slots: inject deterministic calendar slots for local scheduling tests
 */
import twilio from "twilio";
import { buildConsultationBookingKey } from "~/server/appointmentLifecycle/googleCalendar";
import { clearActiveLifecycleForPhone } from "~/server/appointmentLifecycle/store";
import { getRedis } from "~/server/speed2Lead/redis";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { harnessMockOfferSlots, harnessMockRawSlots } from "~/server/speed2Lead/agent/harnessMockSlots";
import { processPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { processPendingPainPrompts } from "~/server/speed2Lead/agent/painPrompt";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { setHarnessOfferSlotsOverride, setHarnessFetchFailureOverride } from "~/server/speed2Lead/agent/scheduling";
import {
  runMechanicalChecks,
  summarizeChecks,
  type CheckContext,
  type TurnSnapshot,
} from "~/server/speed2Lead/agent/testScenarios/checks";
import {
  HARNESS_TEST_PHONE,
  seedAgentSession,
  offeringSlotsSeed,
  bookedReadySeed,
} from "~/server/speed2Lead/agent/testScenarios/seed";
import type { AgentScenario, ScenarioBatch, ScenarioMessage } from "~/server/speed2Lead/agent/testScenarios/types";
import {
  clearAgentSession,
  getAgentSession,
  saveAgentSession,
  type OfferedSlot,
} from "~/server/speed2Lead/agent/state";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";
import { clearOptedOut } from "~/server/speed2Lead/session";
import { normalizePhone } from "~/server/sms/phone";

const DEFAULT_PHONE = HARNESS_TEST_PHONE;
const TURN_SETTLE_MS = 4500;
const PREVIEW_URL = process.env.S2L_PREVIEW_URL ?? "https://deploy-preview-81--624voice.netlify.app";
const PREVIEW_INBOUND_URL = `${PREVIEW_URL}/api/sms/inbound`;

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
    path: "direct_handleAgentInboundSms" | "preview_signed_http";
    phone: string;
    tenantId: string;
    referenceIso: string;
    mockSlots: boolean;
    previewUrl?: string;
  };
  cronAfterStop?: { painSent: number; noResponseSent: number };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let scenarioFilter: string | undefined;
  let mockSlots = false;
  let forceLocal = false;
  let usePreview = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--scenario" && argv[i + 1]) {
      scenarioFilter = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--mock-slots") {
      mockSlots = true;
    } else if (argv[i] === "--force-local") {
      forceLocal = true;
    } else if (argv[i] === "--preview") {
      usePreview = true;
    } else {
      positional.push(argv[i]!);
    }
  }
  return { batchArg: positional[0], scenarioFilter, mockSlots, forceLocal, usePreview };
}

function buildExportName(batchKey: string): string {
  return `build${batchKey
    .split("-")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("")}`;
}

async function resolveBatchModule(batchArg: string): Promise<{ batch: ScenarioBatch; modulePath: string }> {
  const batchKey = batchArg.endsWith(".ts")
    ? path.basename(batchArg, ".ts")
    : batchArg.replace(/\.tsx$/, "");
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
      const buildFn = mod[buildExportName(batchKey)] as ((reference?: Date) => ScenarioBatch) | undefined;
      const batch: ScenarioBatch =
        typeof buildFn === "function" ? buildFn(new Date()) : mod[batchKey.replace(/-/g, "")] ?? mod.default;
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

function signPreviewInbound(body: string, messageSid: string, authToken: string, accountSid: string, fromNumber: string) {
  const params: Record<string, string> = {
    From: DEFAULT_PHONE,
    To: normalizePhone(fromNumber),
    Body: body,
    MessageSid: messageSid,
    AccountSid: accountSid,
  };
  const signature = twilio.getExpectedTwilioSignature(authToken, PREVIEW_INBOUND_URL, params);
  return { params, signature };
}

async function postPreviewInbound(
  body: string,
  messageSid: string,
  twilioCtx: ReturnType<typeof buildTwilioClient>,
): Promise<{ status: number; text: string }> {
  const { params, signature } = signPreviewInbound(
    body,
    messageSid,
    process.env.TWILIO_AUTH_TOKEN!,
    process.env.TWILIO_ACCOUNT_SID!,
    twilioCtx.fromNumber,
  );
  const res = await fetch(PREVIEW_INBOUND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, text: await res.text() };
}

async function dispatchInboundTurn(
  scenario: AgentScenario,
  phone: string,
  inbound: string,
  messageSid: string,
  execution: "local" | "preview",
  twilioCtx: ReturnType<typeof buildTwilioClient>,
): Promise<void> {
  if (execution === "preview") {
    const result = await postPreviewInbound(inbound, messageSid, twilioCtx);
    if (result.status !== 200) {
      throw new Error(`Preview inbound failed (${result.status}): ${result.text}`);
    }
    return;
  }
  await handleAgentInboundSms(phone, inbound, messageSid);
}

async function occupyFirstOfferedSlot(
  phone: string,
  execution: "local" | "preview",
  twilioCtx: ReturnType<typeof buildTwilioClient>,
  firstName: string,
): Promise<OfferedSlot | null> {
  const setupSid = (step: number) => `SM-harness-occupy-${Date.now()}-${step}`;
  await dispatchInboundTurn(
    { execution } as AgentScenario,
    phone,
    "Yes let's schedule",
    setupSid(0),
    execution,
    twilioCtx,
  );
  await sleep(TURN_SETTLE_MS);

  const afterAgree = await getAgentSession(phone);
  const slot = afterAgree?.offeredSlots[0];
  if (!slot) return null;

  await dispatchInboundTurn(
    { execution } as AgentScenario,
    phone,
    "The first one works",
    setupSid(1),
    execution,
    twilioCtx,
  );
  await sleep(TURN_SETTLE_MS);

  await dispatchInboundTurn(
    { execution } as AgentScenario,
    phone,
    "Yes book it",
    setupSid(2),
    execution,
    twilioCtx,
  );
  await sleep(TURN_SETTLE_MS);

  const afterBook = await getAgentSession(phone);
  if (afterBook?.stage !== "booked") return null;

  await clearActiveLifecycleForPhone(phone);
  const bookingKey = buildConsultationBookingKey(phone, slot.startIso);
  await getRedis().del(`appointment:booking:idempotency:${bookingKey}`);
  await clearAgentSession(phone);
  await clearOptedOut(phone);
  await seedAgentSession(offeringSlotsSeed(firstName, [slot]), phone);
  return slot;
}

function resolveScenarioSeed(scenario: AgentScenario) {
  const bookedIso = scenario.meta?.seedBookedStartIso as string | undefined;
  const bookedEventId = scenario.meta?.seedBookedEventId as string | undefined;
  if (bookedIso) {
    return bookedReadySeed(scenario.seed.firstName ?? "Test", bookedIso, bookedEventId);
  }
  return scenario.seed;
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
  globalMockSlots: boolean,
  forceLocal: boolean,
  globalPreview: boolean,
): Promise<ScenarioReport> {
  await resetHarnessPhone(phone);

  const useMockSlots = globalMockSlots || scenario.useMockSlots === true;
  const execution: "local" | "preview" =
    forceLocal || (useMockSlots && globalMockSlots)
      ? "local"
      : globalPreview || scenario.execution === "preview" || !useMockSlots
        ? "preview"
        : (scenario.execution ?? "local");
  if (useMockSlots && execution === "local") {
    setHarnessOfferSlotsOverride(
      () => harnessMockOfferSlots(getActiveProfile()),
      () => harnessMockRawSlots(getActiveProfile()),
    );
  } else {
    setHarnessOfferSlotsOverride(null);
  }

  if (scenario.meta?.calendarFetchFailure === true && execution === "local") {
    setHarnessFetchFailureOverride(() => ({ ok: false, reason: "harness_calendar_api_error" }));
  } else {
    setHarnessFetchFailureOverride(null);
  }

  const runStartedAt = new Date();
  const referenceIso = (scenario.meta?.referenceIso as string) ?? runStartedAt.toISOString();

  await seedAgentSession(resolveScenarioSeed(scenario), phone);

  if (scenario.meta?.occupyFirstOfferedSlot === true) {
    const occupied = await occupyFirstOfferedSlot(
      phone,
      execution,
      twilioCtx,
      scenario.seed.firstName ?? "Test",
    );
    if (!occupied) {
      throw new Error(`Failed to pre-occupy first offered slot for ${scenario.id}`);
    }
  }

  const turnSnapshots: TurnSnapshot[] = [];
  let stopAt: string | undefined;

  try {
    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
      const turn = scenario.turns[turnIndex]!;
      if (turn.delayMs) {
        await sleep(turn.delayMs);
      }

      if (turn.inbound.trim().toUpperCase() === "STOP") {
        stopAt = new Date().toISOString();
      }

      const messageSid =
        scenario.meta?.replayDuplicateMessageSid && turnIndex === 0
          ? `SM-harness-dup-${scenario.id}`
          : `SM-harness-${scenario.id}-${turnIndex}-${Date.now()}`;
      await dispatchInboundTurn(scenario, phone, turn.inbound, messageSid, execution, twilioCtx);
      if (scenario.meta?.replayDuplicateMessageSid && turnIndex === 0) {
        await sleep(500);
        await dispatchInboundTurn(scenario, phone, turn.inbound, messageSid, execution, twilioCtx);
      }
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
  } finally {
    setHarnessOfferSlotsOverride(null);
    setHarnessFetchFailureOverride(null);
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
      path: execution === "preview" ? "preview_signed_http" : "direct_handleAgentInboundSms",
      phone,
      tenantId: getActiveProfile().tenantId,
      referenceIso,
      mockSlots: useMockSlots,
      previewUrl: execution === "preview" ? PREVIEW_URL : undefined,
    },
    cronAfterStop,
  };
}

async function main() {
  const { batchArg, scenarioFilter, mockSlots, forceLocal, usePreview } = parseArgs(process.argv.slice(2));
  if (!batchArg) {
    console.error(
      "Usage: bun run scripts/agent-edge-case-harness.ts <batch-file> [--scenario <id>] [--mock-slots] [--preview] [--force-local]",
    );
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
        mockSlots,
        forceLocal,
        usePreview,
        previewUrl: usePreview ? PREVIEW_URL : undefined,
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
    const report = await runScenario(scenario, phone, twilioCtx, mockSlots, forceLocal, usePreview);
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
