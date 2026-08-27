#!/usr/bin/env bun
/**
 * No-response campaign verification on preview-81 (handset +12149722278 only).
 * Run: bun run scripts/s2l-no-response-verify.ts
 */
import twilio from "twilio";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  buildNoResponseMessage1,
  buildNoResponseMessage2,
  noResponseDueAt,
  processPendingNoResponseCampaign,
} from "~/server/speed2Lead/agent/noResponseCampaign";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import {
  clearAgentSession,
  getAgentSession,
  listPendingNoResponsePhones,
  saveAgentSession,
} from "~/server/speed2Lead/agent/state";
import { clearOptedOut } from "~/server/speed2Lead/session";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";

const PREVIEW_URL = process.env.S2L_PREVIEW_URL ?? "https://deploy-preview-81--624voice.netlify.app";
const CRON_URL = `${PREVIEW_URL}/api/cron/agent-no-response-followups`;
const TEST_PHONE = "+12149722278";
const NO_RESPONSE_PENDING_KEY = "speed2lead:agent:no-response-pending";

const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const twilioClient = twilio(accountSid, authToken);
const profile = getActiveProfile();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function sessionSnapshot(session: Awaited<ReturnType<typeof getAgentSession>>) {
  if (!session) return null;
  return {
    noResponseStage: session.noResponseStage,
    noResponseNextAt: session.noResponseNextAt,
    noResponseResolved: session.noResponseResolved,
    createdAt: session.createdAt,
    firstName: session.firstName,
    painPromptResolved: session.painPromptResolved,
    messageCount: session.messages.length,
    lastAssistant: [...session.messages].reverse().find((m) => m.role === "assistant")?.content,
  };
}

async function redisPending(): Promise<string[]> {
  return listPendingNoResponsePhones();
}

async function listOutboundSince(since: Date) {
  const messages = await twilioClient.messages.list({
    to: normalizePhone(TEST_PHONE),
    from: normalizePhone(fromNumber),
    dateSentAfter: since,
    limit: 30,
  });
  return messages
    .filter((m) => m.direction.startsWith("outbound"))
    .sort((a, b) => a.dateSent!.getTime() - b.dateSent!.getTime());
}

function formatMsg(m: twilio.Api.V2010.MessageInstance) {
  return {
    sid: m.sid,
    sentAt: m.dateSent?.toISOString() ?? null,
    body: m.body ?? "",
  };
}

async function callPreviewCron(): Promise<{
  source: "preview-http" | "local-handler";
  status?: number;
  body?: string;
  sent?: number;
}> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const res = await fetch(CRON_URL, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    if (res.ok) {
      const parsed = JSON.parse(body) as { ok: boolean; sent: number };
      return { source: "preview-http", status: res.status, body, sent: parsed.sent };
    }
    return { source: "preview-http", status: res.status, body };
  }

  const sent = await processPendingNoResponseCampaign();
  return { source: "local-handler", sent };
}

async function backdateDue(session: NonNullable<Awaited<ReturnType<typeof getAgentSession>>>) {
  const updated = {
    ...session,
    painPromptResolved: true,
    painPromptDueAt: undefined,
    noResponseNextAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await saveAgentSession(updated);
  return updated;
}

async function runStageTest(stageLabel: string, marker: string, expectedPrefix: string) {
  const beforeSession = await getAgentSession(TEST_PHONE);
  const beforePending = await redisPending();
  const pollSince = new Date(Date.now() - 5000);

  await backdateDue(beforeSession!);

  const afterBackdate = sessionSnapshot(await getAgentSession(TEST_PHONE));
  const cron = await callPreviewCron();
  await sleep(4000);

  const outbound = await listOutboundSince(pollSince);
  const received = outbound.find((m) => (m.body ?? "").includes(marker));
  const afterSession = sessionSnapshot(await getAgentSession(TEST_PHONE));
  const afterPending = await redisPending();

  const stageIndex = beforeSession?.noResponseStage ?? 0;
  const expectedNextStage = stageIndex + 1;
  const expectedNextAt =
    beforeSession && expectedNextStage < 5
      ? noResponseDueAt(beforeSession, profile, expectedNextStage)
      : undefined;

  return {
    stageLabel,
    stageIndexBefore: stageIndex,
    expectedPrefix,
    before: {
      session: sessionSnapshot(beforeSession),
      redisPending: beforePending,
    },
    afterBackdate,
    cron,
    messageReceived: received ? formatMsg(received) : null,
    after: {
      session: afterSession,
      redisPending: afterPending,
      expectedNextStage,
      expectedNextAt,
    },
    checks: {
      messageReceived: Boolean(received),
      contentMatchesExpected: received ? received.body?.startsWith(expectedPrefix) : false,
      stageAdvanced: afterSession?.noResponseStage === expectedNextStage,
      nextAtCorrect:
        expectedNextStage >= 5
          ? afterSession?.noResponseResolved === true && afterSession?.noResponseNextAt == null
          : afterSession?.noResponseNextAt === expectedNextAt,
      stillPendingWhenMoreStages: expectedNextStage < 5 ? afterPending.includes(normalizePhone(TEST_PHONE)) : !afterPending.includes(normalizePhone(TEST_PHONE)),
    },
  };
}

async function main() {
  const health = await fetch(`${PREVIEW_URL}/api/health`).then((r) => r.json());
  console.log("Preview health:", health);
  console.log("Cron auth mode:", process.env.CRON_SECRET ? "CRON_SECRET bearer" : "local processPendingNoResponseCampaign() fallback");

  await resetSpeed2LeadTestPhone(TEST_PHONE);
  await clearAgentSession(TEST_PHONE);
  await clearOptedOut(TEST_PHONE);

  const runId = Date.now();
  const startedAt = new Date();
  await startAgentConversation({
    phone: TEST_PHONE,
    firstName: "Jamie",
    lastName: "Verify",
    businessName: `NoResp ${runId}`,
    email: `noresp+${runId}@example.com`,
    annualOpportunity: "$118,500",
    primaryOpportunity: "Missed calls",
    reportUrl: `https://624voice.com/report/noresp-${runId}`,
  });
  await sleep(3000);

  const freshSession = await getAgentSession(TEST_PHONE);
  const freshPending = await redisPending();
  const expectedStage1 = buildNoResponseMessage1(profile, freshSession!);
  const expectedStage2 = buildNoResponseMessage2(profile, freshSession!);

  console.log("\n========== FRESH SESSION ==========");
  console.log(
    JSON.stringify(
      {
        session: sessionSnapshot(freshSession),
        redisPending: freshPending,
        expectedStage1DueAt: freshSession ? noResponseDueAt(freshSession, profile, 0) : null,
        expectedStage1Message: expectedStage1,
      },
      null,
      2,
    ),
  );

  const stage1 = await runStageTest(
    "Stage 1 (+4h check-in)",
    "just making sure you saw the ROI report",
    "Hi Jamie — just making sure you saw the ROI report",
  );

  const stage2 = await runStageTest(
    "Stage 2 (Day 1)",
    "Quick thought — even if your team is doing a solid job",
    "Hi Jamie. Quick thought — even if your team is doing a solid job",
  );

  console.log("\n========== STAGE 1 RESULT ==========");
  console.log(JSON.stringify(stage1, null, 2));
  console.log("\n========== STAGE 2 RESULT ==========");
  console.log(JSON.stringify(stage2, null, 2));

  const summary = {
    previewSha: (health as { gitCommitSha?: string }).gitCommitSha,
    cronAuthMode: process.env.CRON_SECRET ? "preview-http" : "local-handler-fallback",
    stage1Pass: Object.values(stage1.checks).every(Boolean),
    stage2Pass: Object.values(stage2.checks).every(Boolean),
  };
  console.log("\n========== SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.stage1Pass || !summary.stage2Pass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
