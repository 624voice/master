#!/usr/bin/env bun
/**
 * Preview duplicate-check for Speed2Lead agent v2.
 * Opener: local concurrent double-start (same Redis/Twilio as preview).
 * Inbound: signed POSTs to preview-81 deployed webhook.
 */
import twilio from "twilio";
import { Redis } from "@upstash/redis";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import { clearAgentSession, createAgentSession, getAgentSession, saveAgentSession } from "~/server/speed2Lead/agent/state";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";

const PREVIEW_URL = process.env.S2L_PREVIEW_URL ?? "https://deploy-preview-81--624voice.netlify.app";
const TEST_PHONE = "+12149722278";
const INBOUND_URL = `${PREVIEW_URL}/api/sms/inbound`;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const twilioClient = twilio(accountSid, authToken);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function clearAllState(phone: string) {
  await clearAgentSession(phone);
  const normalized = normalizePhone(phone);
  await redis.del(`speed2lead:agent:phone-lock:${normalized}`);
  await redis.del(`speed2lead:session:${normalized}`);
}

async function listOutboundSince(phone: string, since: Date) {
  const messages = await twilioClient.messages.list({
    to: normalizePhone(phone),
    from: normalizePhone(fromNumber),
    dateSentAfter: since,
    limit: 40,
  });
  return messages
    .filter((m) => m.direction.startsWith("outbound"))
    .sort((a, b) => a.dateSent!.getTime() - b.dateSent!.getTime());
}

function countDuplicateBodies(messages: twilio.Api.V2010.MessageInstance[]) {
  const byBody = new Map<string, number>();
  for (const msg of messages) {
    const body = msg.body ?? "";
    byBody.set(body, (byBody.get(body) ?? 0) + 1);
  }
  return [...byBody.entries()].filter(([, count]) => count > 1);
}

function signInboundParams(params: Record<string, string>) {
  return twilio.getExpectedTwilioSignature(authToken, INBOUND_URL, params);
}

async function postSignedInbound(body: string, messageSid: string, concurrent = 1) {
  const params: Record<string, string> = {
    From: TEST_PHONE,
    To: normalizePhone(fromNumber),
    Body: body,
    MessageSid: messageSid,
    AccountSid: accountSid,
  };
  const signature = signInboundParams(params);
  const form = new URLSearchParams(params);
  const post = () =>
    fetch(INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature,
      },
      body: form.toString(),
    }).then((r) => r.status);

  if (concurrent <= 1) {
    return [await post()];
  }
  return Promise.all(Array.from({ length: concurrent }, () => post()));
}

async function checkHealth() {
  const response = await fetch(`${PREVIEW_URL}/api/health`);
  return response.json() as Promise<{ gitCommitSha: string }>;
}

async function testOpenerDoubleStart() {
  console.log("\n=== Opener: concurrent double-start ===");
  await clearAllState(TEST_PHONE);
  await sleep(1500);
  const since = new Date();
  const runId = String(Date.now());
  const input = {
    phone: TEST_PHONE,
    firstName: "Dup",
    lastName: "Check",
    businessName: `DupCheck ${runId}`,
    email: `dupcheck+${runId}@example.com`,
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/dup-check",
  };

  await Promise.all([startAgentConversation(input), startAgentConversation(input)]);
  await sleep(5000);

  const messages = await listOutboundSince(TEST_PHONE, since);
  const openerMessages = messages.filter((m) => (m.body ?? "").includes("DupCheck"));
  const dupes = countDuplicateBodies(openerMessages);
  const session = await getAgentSession(TEST_PHONE);
  const pass = openerMessages.length === 1 && dupes.length === 0 && session !== null;
  console.log("opener outbound count:", openerMessages.length);
  console.log("agent session created:", Boolean(session));
  console.log("opener duplicate bodies:", dupes);
  return { pass, count: openerMessages.length, dupes, sessionCreated: Boolean(session) };
}

async function ensureBridgeStage() {
  let session = await getAgentSession(TEST_PHONE);
  if (!session) throw new Error("No agent session after opener");

  if (session.stage === "discovery") {
    console.log("advancing: pain reply");
    await postSignedInbound("Missed calls mostly", `SM-pain-${Date.now()}`);
    await sleep(28000);
    session = await getAgentSession(TEST_PHONE);
  }

  if (session && session.stage === "discovery") {
    console.log("advancing: bridge interest");
    await postSignedInbound("Yeah I'd like to chat", `SM-bridge-seed-${Date.now()}`);
    await sleep(28000);
    session = await getAgentSession(TEST_PHONE);
  }

  console.log("session stage before mid-turn test:", session?.stage);
  return session;
}

async function testMidTurnDuplicate() {
  console.log("\n=== Mid-turn: concurrent duplicate inbound ===");
  await ensureBridgeStage();
  const since = new Date();
  const sid = `SM-mid-${Date.now()}`;
  const statuses = await postSignedInbound("Yes", sid, 2);
  console.log("concurrent inbound statuses:", statuses);
  await sleep(32000);

  const messages = await listOutboundSince(TEST_PHONE, since);
  const dupes = countDuplicateBodies(messages);
  const pass = dupes.length === 0 && messages.length <= 2;
  console.log("mid-turn outbound count:", messages.length);
  for (const msg of messages) {
    console.log("-", msg.sid, (msg.body ?? "").slice(0, 90));
  }
  console.log("mid-turn duplicate bodies:", dupes);
  return { pass, count: messages.length, dupes };
}

async function seedOfferingSlotsIfNeeded() {
  let session = await getAgentSession(TEST_PHONE);
  if (!session) throw new Error("No agent session for booking test");
  if (session.stage === "offering_slots" && session.offeredSlots.length > 0) {
    return session;
  }

  if (session.stage !== "offering_slots") {
    console.log("advancing to slot offer (single inbound)");
    await postSignedInbound("Yes", `SM-bridge-single-${Date.now()}`);
    await sleep(32000);
    session = await getAgentSession(TEST_PHONE);
  }

  if (!session || session.stage !== "offering_slots" || session.offeredSlots.length === 0) {
    console.log("seeding offering_slots in Redis for booking probe");
    const profile = getActiveProfile();
    session = {
      ...(session ??
        createAgentSession({
          tenantId: profile.tenantId,
          phone: TEST_PHONE,
          firstName: "Dup",
          businessName: "DupCheck",
        })),
      stage: "offering_slots",
      offeredSlots: [
        { startIso: "2026-09-02T19:00:00.000Z", label: "Wednesday Sep 2, 2:00pm CT" },
        { startIso: "2026-09-02T20:30:00.000Z", label: "Wednesday Sep 2, 3:30pm CT" },
      ],
      painPromptResolved: true,
    };
    await saveAgentSession(session);
  }

  console.log("session stage before booking test:", session.stage, "slots:", session.offeredSlots.length);
  return session;
}

async function testBookingDuplicate() {
  console.log("\n=== Booking: concurrent duplicate slot selection ===");
  await seedOfferingSlotsIfNeeded();
  const since = new Date();
  const sid = `SM-book-${Date.now()}`;
  const statuses = await postSignedInbound("1", sid, 2);
  console.log("concurrent booking inbound statuses:", statuses);
  await sleep(40000);

  const messages = await listOutboundSince(TEST_PHONE, since);
  const dupes = countDuplicateBodies(messages);
  const pass = dupes.length === 0;
  console.log("booking outbound count:", messages.length);
  for (const msg of messages) {
    console.log("-", msg.sid, (msg.body ?? "").slice(0, 100));
  }
  console.log("booking duplicate bodies:", dupes);
  return { pass, count: messages.length, dupes };
}

async function main() {
  const health = await checkHealth();
  console.log("preview health sha:", health.gitCommitSha.slice(0, 7));

  const opener = await testOpenerDoubleStart();
  const mid = await testMidTurnDuplicate();
  const booking = await testBookingDuplicate();

  const summary = {
    previewSha: health.gitCommitSha,
    opener,
    midTurn: mid,
    booking,
    allPass: opener.pass && mid.pass && booking.pass,
  };
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
