import {
  buildClearNeedOpener,
  buildVagueInquiryOpener,
  buildAlreadyClearOpener,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import { expectedNoResponseDay1 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import type { ContactCheckContext } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { listPendingNoResponsePhones } from "~/server/speed2Lead/agent/state";
import { isOptedOut } from "~/server/speed2Lead/session";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

export type CheckResult = { pass: boolean; detail: string };
export type ContactMechanicalCheck = (ctx: ContactCheckContext) => CheckResult | Promise<CheckResult>;

function lastAssistant(transcript: ContactCheckContext["transcript"]): string | null {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === "assistant") return transcript[i]!.content;
  }
  return null;
}

export const CONTACT_MECHANICAL_CHECKS: Record<string, ContactMechanicalCheck> = {
  clearOpenerShape(ctx) {
    const opener = ctx.seed.messages?.[0]?.content ?? "";
    const expected = buildClearNeedOpener({
      ...ctx.session!,
      firstName: ctx.seed.firstName,
      businessName: ctx.seed.businessName ?? "Test Plumbing",
      helpTextSummary: ctx.seed.helpTextSummary,
      inquiryClarity: "clear",
    });
    return opener === expected
      ? { pass: true, detail: "Clear opener matches template" }
      : { pass: false, detail: `Expected clear opener; got: ${opener.slice(0, 80)}` };
  },
  vagueOpenerShape(ctx) {
    const opener = ctx.seed.messages?.[0]?.content ?? "";
    const expected = buildVagueInquiryOpener({
      ...ctx.session!,
      inquiryClarity: "vague",
    });
    return opener.includes("What's making now the time")
      ? { pass: true, detail: "Vague opener present" }
      : { pass: false, detail: `Expected vague opener; got: ${opener}` };
  },
  alreadyClearOpenerShape(ctx) {
    const opener = ctx.seed.messages?.[0]?.content ?? "";
    return opener.includes("would it be worth 25 minutes")
      ? { pass: true, detail: "Already-clear bridge opener present" }
      : { pass: false, detail: `Missing bridge opener: ${opener}` };
  },
  discoveryCapAtTwo(ctx) {
    const count = ctx.session?.discoveryQuestionCount ?? 0;
    return count <= 2
      ? { pass: true, detail: `discoveryQuestionCount=${count}` }
      : { pass: false, detail: `discoveryQuestionCount exceeded cap: ${count}` };
  },
  discoveryClosedAfterMeetingIntent(ctx) {
    return ctx.session?.discoveryClosed
      ? { pass: true, detail: "discoveryClosed=true" }
      : { pass: false, detail: "Expected discoveryClosed after direct meeting intent" };
  },
  stopOptedOut(ctx) {
    return ctx.stopOptedOut
      ? { pass: true, detail: "Phone opted out after STOP" }
      : { pass: false, detail: "Expected opt-out flag" };
  },
  stopNoOutboundAfter(ctx) {
    const after = ctx.outboundAfterStop ?? [];
    return after.length === 0
      ? { pass: true, detail: "No outbound SMS after STOP" }
      : { pass: false, detail: `Unexpected outbound after STOP: ${after.length}` };
  },
  crossFlowBlockedSecondOpener(ctx) {
    return ctx.crossFlowBlocked
      ? { pass: true, detail: "Second-flow opener was blocked" }
      : { pass: false, detail: "Expected cross-flow opener block" };
  },
  noResponseDay1ClearVariant(ctx) {
    if (!ctx.session) return { pass: false, detail: "No session" };
    const expected = expectedNoResponseDay1(ctx.session);
    return expected.includes("You mentioned")
      ? { pass: true, detail: "Day-1 clear variant template available" }
      : { pass: false, detail: "Expected clear Day-1 copy" };
  },
  noResponseDay1VagueVariant(ctx) {
    if (!ctx.session) return { pass: false, detail: "No session" };
    const session = { ...ctx.session, inquiryClarity: "vague" as const };
    const expected = expectedNoResponseDay1(session);
    return expected.includes("capture more opportunities")
      ? { pass: true, detail: "Day-1 vague variant template available" }
      : { pass: false, detail: "Expected vague Day-1 copy" };
  },
  injectionRedirect(ctx) {
    const reply = lastAssistant(ctx.transcript);
    return reply?.includes("just handling scheduling")
      ? { pass: true, detail: "Injection redirect sent" }
      : { pass: false, detail: `Expected injection redirect; got: ${reply}` };
  },
  offTopicRedirect(ctx) {
    const reply = lastAssistant(ctx.transcript);
    return reply?.includes("happy to pick that back up")
      ? { pass: true, detail: "Off-topic redirect sent" }
      : { pass: false, detail: `Expected off-topic redirect; got: ${reply}` };
  },
};

export async function runContactMechanicalChecks(
  names: string[],
  ctx: ContactCheckContext,
): Promise<Record<string, CheckResult>> {
  const results: Record<string, CheckResult> = {};
  for (const name of names) {
    const check = CONTACT_MECHANICAL_CHECKS[name];
    if (!check) {
      results[name] = { pass: false, detail: `Unknown check: ${name}` };
      continue;
    }
    results[name] = await check(ctx);
  }
  return results;
}

export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  return isOptedOut(phone);
}

export async function countAgentSessions(phone: string): Promise<number> {
  const redis = getRedis();
  const session = await redis.get(`speed2lead:agent:session:${normalizePhone(phone)}`);
  return session ? 1 : 0;
}

export async function pendingNoResponseIncludes(phone: string): Promise<boolean> {
  const phones = await listPendingNoResponsePhones();
  return phones.includes(normalizePhone(phone));
}
