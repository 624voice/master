#!/usr/bin/env bun
/**
 * Two-part opener verification on preview-81 (handset +12149722278 only).
 * Run: SPEED2LEAD_AGENT_V2=true bun run scripts/s2l-opener-two-part-verify.ts [scenario]
 * Scenarios: 1 | 2 | 3 | 4 | all (default: all)
 */
import twilio from "twilio";
import { Redis } from "@upstash/redis";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import {
  buildOpenerMessage1,
  buildPainPromptMessage,
  processPendingPainPrompts,
} from "~/server/speed2Lead/agent/painPrompt";
import {
  clearAgentSession,
  getAgentSession,
  listPendingPainPromptPhones,
} from "~/server/speed2Lead/agent/state";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { clearOptedOut } from "~/server/speed2Lead/session";
import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";

const PREVIEW_URL = process.env.S2L_PREVIEW_URL ?? "https://deploy-preview-81--624voice.netlify.app";
const TEST_PHONE = "+12149722278";
const INBOUND_URL = `${PREVIEW_URL}/api/sms/inbound`;
const CRON_URL = `${PREVIEW_URL}/api/cron/agent-pain-prompts`;
const PAIN_PENDING_KEY = "speed2lead:agent:pain-prompt-pending";
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const twilioClient = twilio(accountSid, authToken);
const profile = getActiveProfile();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function iso(d = new Date()) {
  return d.toISOString();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function fetchHealth() {
  const res = await fetch(`${PREVIEW_URL}/api/health`);
  return res.json() as Promise<{ gitCommitSha: string; buildTimestamp?: string }>;
}

async function resetHandset() {
  await resetSpeed2LeadTestPhone(TEST_PHONE);
  await clearAgentSession(TEST_PHONE);
  await clearOptedOut(TEST_PHONE);
}

async function pendingPhones(): Promise<string[]> {
  return listPendingPainPromptPhones();
}

async function listOutboundSince(since: Date) {
  const messages = await twilioClient.messages.list({
    to: normalizePhone(TEST_PHONE),
    from: normalizePhone(fromNumber),
    dateSentAfter: since,
    limit: 20,
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

async function triggerRoiLead(label: string, firstName: string) {
  const runId = Date.now();
  const businessName = `${label} ${runId}`;
  const annualOpportunity = "$118,500";
  const input = {
    phone: TEST_PHONE,
    firstName,
    lastName: "Verify",
    businessName,
    email: `verify+${runId}@example.com`,
    annualOpportunity,
    primaryOpportunity: "Missed calls",
    reportUrl: `https://624voice.com/report/verify-${runId}`,
  };
  const expectedMsg1 = buildOpenerMessage1(profile, {
    firstName,
    businessName,
    annualOpportunity,
  });
  const startedAt = new Date();
  await startAgentConversation(input);
  await sleep(4000);
  const outbound = await listOutboundSince(startedAt);
  const msg1 = outbound.find((m) => (m.body ?? "").includes(businessName)) ?? outbound.at(-1);
  const session = await getAgentSession(TEST_PHONE);
  return {
    startedAt: iso(startedAt),
    businessName,
    expectedMsg1,
    msg1: msg1 ? formatMsg(msg1) : null,
    session: session
      ? {
          painPromptDueAt: session.painPromptDueAt,
          painPromptResolved: session.painPromptResolved,
          stage: session.stage,
        }
      : null,
    pendingAfterStart: await pendingPhones(),
  };
}

function signInbound(body: string, messageSid: string) {
  const params: Record<string, string> = {
    From: TEST_PHONE,
    To: normalizePhone(fromNumber),
    Body: body,
    MessageSid: messageSid,
    AccountSid: accountSid,
  };
  const signature = twilio.getExpectedTwilioSignature(authToken, INBOUND_URL, params);
  return { params, signature };
}

async function postInbound(body: string, messageSid: string) {
  const { params, signature } = signInbound(body, messageSid);
  const form = new URLSearchParams(params);
  const res = await fetch(INBOUND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: form.toString(),
  });
  return { status: res.status, body: await res.text() };
}

async function callPreviewCron() {
  const attempts: Array<{ auth: string; status: number; body: string }> = [];
  for (const auth of ["none", process.env.CRON_SECRET].filter(Boolean) as string[]) {
    const headers: Record<string, string> = {};
    if (auth !== "none") headers.Authorization = `Bearer ${auth}`;
    const res = await fetch(CRON_URL, { headers });
    attempts.push({
      auth: auth === "none" ? "none" : "CRON_SECRET",
      status: res.status,
      body: await res.text(),
    });
  }
  return attempts;
}

async function waitForPainPromptDue(dueAtIso: string, maxWaitMs = 6 * 60_000) {
  const dueMs = new Date(dueAtIso).getTime();
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (Date.now() >= dueMs) return { ready: true, waitedMs: Date.now() - (dueMs - profile.painPromptDelayMinutes * 60_000) };
    await sleep(5000);
  }
  return { ready: false, waitedMs: maxWaitMs };
}

async function scenario1() {
  console.log("\n========== SCENARIO 1: Message 1 immediate ==========");
  await resetHandset();
  const result = await triggerRoiLead("OpenerS1", "Alex");
  const msg1 = result.msg1;
  const checks = {
    hasMsg1: Boolean(msg1),
    noQuestionInMsg1: msg1 ? !msg1.body.includes("?") : false,
    hasBusinessName: msg1 ? msg1.body.includes(result.businessName) : false,
    hasOpportunity: msg1 ? msg1.body.includes("$118,500") : false,
    signedChris: msg1 ? msg1.body.includes("Chris Hutson") : false,
    signed624: msg1 ? msg1.body.includes("624 Voice") : false,
    inPendingSet: result.pendingAfterStart.includes(normalizePhone(TEST_PHONE)),
  };
  console.log(JSON.stringify({ result, checks }, null, 2));
  return { pass: Object.values(checks).every(Boolean), ...result, checks };
}

async function scenario2() {
  console.log("\n========== SCENARIO 2: Message 2 after ~5 min via cron ==========");
  await resetHandset();
  const start = await triggerRoiLead("OpenerS2", "Blake");
  const dueAt = start.session?.painPromptDueAt;
  if (!dueAt) throw new Error("No painPromptDueAt on session");

  console.log("Waiting for painPromptDueAt:", dueAt);
  await waitForPainPromptDue(dueAt, 6 * 60_000);
  const dueReachedAt = iso();

  const cronAttemptsBefore = await callPreviewCron();
  let cronResponse: { source: string; status?: number; body?: unknown; sent?: number } | null = null;
  let msg2: ReturnType<typeof formatMsg> | null = null;
  const pollSince = new Date(start.startedAt);
  const expectedMsg2Prefix = buildPainPromptMessage(profile).slice(0, 40);

  // Poll for natural scheduled cron delivery up to 12 minutes after due.
  const pollDeadline = Date.now() + 12 * 60_000;
  while (Date.now() < pollDeadline) {
    const outbound = await listOutboundSince(pollSince);
    const candidate = outbound.find((m) => (m.body ?? "").includes("which part of the report stood out"));
    if (candidate) {
      msg2 = formatMsg(candidate);
      break;
    }
    await sleep(30_000);
  }

  if (!msg2) {
    // Invoke the same handler the cron route calls (preview cron auth not available here).
    const sent = await processPendingPainPrompts();
    cronResponse = { source: "processPendingPainPrompts()", sent };
    await sleep(3000);
    const outbound = await listOutboundSince(pollSince);
    const candidate = outbound.find((m) => (m.body ?? "").includes("which part of the report stood out"));
    msg2 = candidate ? formatMsg(candidate) : null;
  } else {
    cronResponse = { source: "natural/scheduled delivery observed via Twilio", body: "see msg2 timestamp" };
  }

  const cronAttemptsAfter = await callPreviewCron();
  const msg1At = start.msg1?.sentAt ? new Date(start.msg1.sentAt).getTime() : 0;
  const msg2At = msg2?.sentAt ? new Date(msg2.sentAt).getTime() : 0;
  const delayMin = msg1At && msg2At ? (msg2At - msg1At) / 60_000 : null;

  const checks = {
    msg2Received: Boolean(msg2),
    delayAtLeast5Min: delayMin != null ? delayMin >= 4.5 : false,
    msg2IsPainQuestion: msg2 ? msg2.body.includes("which part of the report stood out") : false,
    dequeuedAfterSend: !(await pendingPhones()).includes(normalizePhone(TEST_PHONE)),
    sessionResolved: (await getAgentSession(TEST_PHONE))?.painPromptResolved === true,
  };

  const evidence = {
    start,
    dueAt,
    dueReachedAt,
    cronAttemptsBefore,
    cronAttemptsAfter,
    cronResponse,
    msg2,
    delayMinutes: delayMin,
    expectedMsg2Sample: buildPainPromptMessage(profile),
    pendingAfter: await pendingPhones(),
    checks,
  };
  console.log(JSON.stringify(evidence, null, 2));
  return { pass: Object.values(checks).every(Boolean), evidence };
}

async function scenario3() {
  console.log("\n========== SCENARIO 3: Early reply cancels message 2 ==========");
  await resetHandset();
  const start = await triggerRoiLead("OpenerS3", "Casey");
  const pendingBeforeReply = await pendingPhones();
  const replyAt = iso();
  const inbound = await postInbound("Missed calls mostly", `SM-s3-${Date.now()}`);
  await sleep(5000);
  const pendingAfterReply = await pendingPhones();
  const session = await getAgentSession(TEST_PHONE);

  // Wait past due time + buffer; message 2 must not arrive.
  if (session?.painPromptDueAt) {
    await waitForPainPromptDue(session.painPromptDueAt, 6 * 60_000);
  }
  await processPendingPainPrompts();
  await sleep(2000);
  const pollSince = new Date(start.startedAt);
  const outbound = await listOutboundSince(pollSince);
  const painMsgs = outbound.filter((m) => (m.body ?? "").includes("which part of the report stood out"));

  const checks = {
    wasPendingBeforeReply: pendingBeforeReply.includes(normalizePhone(TEST_PHONE)),
    dequeuedAfterReply: !pendingAfterReply.includes(normalizePhone(TEST_PHONE)),
    painPromptResolved: session?.painPromptResolved === true,
    noMsg2Sent: painMsgs.length === 0,
    inboundOk: inbound.status === 200,
  };
  const evidence = {
    start,
    replyAt,
    inbound,
    pendingBeforeReply,
    pendingAfterReply,
    sessionAfterReply: session
      ? {
          painPromptDueAt: session.painPromptDueAt,
          painPromptResolved: session.painPromptResolved,
        }
      : null,
    outboundCount: outbound.length,
    painPromptMessages: painMsgs.map(formatMsg),
    checks,
  };
  console.log(JSON.stringify(evidence, null, 2));
  return { pass: Object.values(checks).every(Boolean), evidence };
}

async function scenario4() {
  console.log("\n========== SCENARIO 4: STOP before message 2 ==========");
  await resetHandset();
  const start = await triggerRoiLead("OpenerS4", "Dana");
  const pendingBeforeStop = await pendingPhones();
  const stopAt = iso();
  const inbound = await postInbound("STOP", `SM-s4-${Date.now()}`);
  await sleep(3000);
  const pendingAfterStop = await pendingPhones();
  const session = await getAgentSession(TEST_PHONE);

  if (session?.painPromptDueAt) {
    await waitForPainPromptDue(session.painPromptDueAt, 6 * 60_000);
  }
  await processPendingPainPrompts();
  await sleep(2000);
  const pollSince = new Date(start.startedAt);
  const outbound = await listOutboundSince(pollSince);
  const afterStop = outbound.filter((m) => new Date(m.dateSent!).getTime() > new Date(stopAt).getTime());

  const checks = {
    wasPendingBeforeStop: pendingBeforeStop.includes(normalizePhone(TEST_PHONE)),
    dequeuedAfterStop: !pendingAfterStop.includes(normalizePhone(TEST_PHONE)),
    inboundOk: inbound.status === 200,
    noOutboundAfterStop: afterStop.length === 0,
    noPainPromptMsg: !outbound.some((m) => (m.body ?? "").includes("which part of the report stood out")),
  };
  const evidence = {
    start,
    stopAt,
    inbound,
    pendingBeforeStop,
    pendingAfterStop,
    sessionAfterStop: session
      ? {
          painPromptDueAt: session.painPromptDueAt,
          painPromptResolved: session.painPromptResolved,
        }
      : null,
    outboundAfterStop: afterStop.map(formatMsg),
    checks,
  };
  console.log(JSON.stringify(evidence, null, 2));
  return { pass: Object.values(checks).every(Boolean), evidence };
}

async function main() {
  const health = await fetchHealth();
  console.log("Preview health:", health);

  const arg = process.argv[2] ?? "all";
  const results: Record<string, unknown> = { previewSha: health.gitCommitSha, ranAt: iso() };

  if (arg === "1" || arg === "all") results.scenario1 = await scenario1();
  if (arg === "2" || arg === "all") results.scenario2 = await scenario2();
  if (arg === "3" || arg === "all") results.scenario3 = await scenario3();
  if (arg === "4" || arg === "all") results.scenario4 = await scenario4();

  console.log("\n========== FINAL SUMMARY ==========");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
