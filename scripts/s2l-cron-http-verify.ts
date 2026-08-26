#!/usr/bin/env bun
/**
 * HTTP cron verification on preview-81 (+12149722278 only).
 * Requires CRON_SECRET in environment — uses preview HTTP routes only.
 */
import twilio from "twilio";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  buildNoResponseMessage1,
  noResponseDueAt,
} from "~/server/speed2Lead/agent/noResponseCampaign";
import { buildPainPromptMessage } from "~/server/speed2Lead/agent/painPrompt";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import {
  clearAgentSession,
  getAgentSession,
  listPendingNoResponsePhones,
  listPendingPainPromptPhones,
  saveAgentSession,
} from "~/server/speed2Lead/agent/state";
import { clearOptedOut } from "~/server/speed2Lead/session";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";

const PREVIEW_URL = process.env.S2L_PREVIEW_URL ?? "https://deploy-preview-81--624voice.netlify.app";
const NO_RESPONSE_CRON = `${PREVIEW_URL}/api/cron/agent-no-response-followups`;
const PAIN_PROMPT_CRON = `${PREVIEW_URL}/api/cron/agent-pain-prompts`;
const TEST_PHONE = "+12149722278";

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error("CRON_SECRET is required for HTTP cron verification");
  process.exit(1);
}

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

function sessionNoResponseSnapshot(session: Awaited<ReturnType<typeof getAgentSession>>) {
  if (!session) return null;
  return {
    noResponseStage: session.noResponseStage,
    noResponseNextAt: session.noResponseNextAt,
    noResponseResolved: session.noResponseResolved,
    createdAt: session.createdAt,
    firstName: session.firstName,
    messageCount: session.messages.length,
  };
}

function sessionPainSnapshot(session: Awaited<ReturnType<typeof getAgentSession>>) {
  if (!session) return null;
  return {
    painPromptDueAt: session.painPromptDueAt,
    painPromptResolved: session.painPromptResolved,
    messageCount: session.messages.length,
  };
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

async function callPreviewCron(url: string): Promise<{ status: number; body: string; parsed?: { ok: boolean; sent: number } }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = await res.text();
  let parsed: { ok: boolean; sent: number } | undefined;
  try {
    parsed = JSON.parse(body) as { ok: boolean; sent: number };
  } catch {
    // keep raw body
  }
  return { status: res.status, body, parsed };
}

async function resetHandset() {
  await resetSpeed2LeadTestPhone(TEST_PHONE);
  await clearAgentSession(TEST_PHONE);
  await clearOptedOut(TEST_PHONE);
}

async function startFreshSession(firstName: string, label: string) {
  const runId = Date.now();
  await startAgentConversation({
    phone: TEST_PHONE,
    firstName,
    lastName: "CronVerify",
    businessName: `${label} ${runId}`,
    email: `cron+${runId}@example.com`,
    annualOpportunity: "$118,500",
    primaryOpportunity: "Missed calls",
    reportUrl: `https://624voice.com/report/cron-${runId}`,
  });
  await sleep(3000);
  return getAgentSession(TEST_PHONE);
}

async function verifyNoResponseCron() {
  console.log("\n========== NO-RESPONSE CRON (HTTP) ==========");
  await resetHandset();
  const session = await startFreshSession("Jamie", "NoRespCron");
  if (!session) throw new Error("No session after start");

  const before = {
    session: sessionNoResponseSnapshot(session),
    redisPending: await listPendingNoResponsePhones(),
  };

  const backdated = {
    ...session,
    painPromptResolved: true,
    painPromptDueAt: undefined,
    noResponseNextAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await saveAgentSession(backdated);

  const pollSince = new Date(Date.now() - 5000);
  const cron = await callPreviewCron(NO_RESPONSE_CRON);
  await sleep(4000);

  const outbound = await listOutboundSince(pollSince);
  const marker = "just making sure you saw the ROI report";
  const message = outbound.find((m) => (m.body ?? "").includes(marker));
  const afterSession = await getAgentSession(TEST_PHONE);
  const after = {
    session: sessionNoResponseSnapshot(afterSession),
    redisPending: await listPendingNoResponsePhones(),
    expectedNextAt: noResponseDueAt(session, profile, 1),
  };

  const expectedMessage = buildNoResponseMessage1(profile, session);
  const result = {
    before,
    afterBackdate: sessionNoResponseSnapshot(await getAgentSession(TEST_PHONE)),
    cron,
    messageReceived: message ? formatMsg(message) : null,
    expectedMessage,
    after,
    checks: {
      http200: cron.status === 200,
      okSent1: cron.parsed?.ok === true && cron.parsed.sent === 1,
      messageReceived: Boolean(message),
      contentExact: message?.body === expectedMessage,
      stageAdvanced: afterSession?.noResponseStage === 1,
      nextAtCorrect: afterSession?.noResponseNextAt === after.expectedNextAt,
      stillPending: after.redisPending.includes(normalizePhone(TEST_PHONE)),
    },
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function verifyPainPromptCron() {
  console.log("\n========== PAIN-PROMPT CRON (HTTP) ==========");
  await resetHandset();
  const session = await startFreshSession("Alex", "PainCron");
  if (!session) throw new Error("No session after start");

  const before = {
    session: sessionPainSnapshot(session),
    redisPending: await listPendingPainPromptPhones(),
  };

  const backdated = {
    ...session,
    painPromptDueAt: new Date(Date.now() - 60_000).toISOString(),
    painPromptResolved: false,
  };
  await saveAgentSession(backdated);

  const pollSince = new Date(Date.now() - 5000);
  const cron = await callPreviewCron(PAIN_PROMPT_CRON);
  await sleep(4000);

  const outbound = await listOutboundSince(pollSince);
  const marker = "which part of the report stood out";
  const message = outbound.find((m) => (m.body ?? "").includes(marker));
  const afterSession = await getAgentSession(TEST_PHONE);
  const after = {
    session: sessionPainSnapshot(afterSession),
    redisPending: await listPendingPainPromptPhones(),
  };

  const expectedMessage = buildPainPromptMessage(profile);
  const result = {
    before,
    afterBackdate: sessionPainSnapshot(await getAgentSession(TEST_PHONE)),
    cron,
    messageReceived: message ? formatMsg(message) : null,
    expectedMessage,
    after,
    checks: {
      http200: cron.status === 200,
      okSent1: cron.parsed?.ok === true && cron.parsed.sent === 1,
      messageReceived: Boolean(message),
      contentExact: message?.body === expectedMessage,
      sessionResolved: afterSession?.painPromptResolved === true,
      dequeued: !after.redisPending.includes(normalizePhone(TEST_PHONE)),
    },
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const health = await fetch(`${PREVIEW_URL}/api/health`).then((r) => r.json());
  console.log("Preview health:", health);
  console.log("Using HTTP cron routes with CRON_SECRET bearer auth");

  const noResponse = await verifyNoResponseCron();
  const painPrompt = await verifyPainPromptCron();

  const summary = {
    previewSha: (health as { gitCommitSha?: string }).gitCommitSha,
    noResponsePass: Object.values(noResponse.checks).every(Boolean),
    painPromptPass: Object.values(painPrompt.checks).every(Boolean),
  };
  console.log("\n========== SUMMARY ==========");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.noResponsePass || !summary.painPromptPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
