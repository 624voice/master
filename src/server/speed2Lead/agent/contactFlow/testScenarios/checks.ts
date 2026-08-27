import {
  buildClearNeedOpener,
  buildVagueInquiryOpener,
  buildAlreadyClearOpener,
  buildDeclineDiagnosisQuestion,
  buildTimingDeclineExit,
  PRICING_RESPONSE_COPY,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import {
  isConsequenceQuestion,
  MAX_DISCOVERY_QUESTIONS,
} from "~/server/speed2Lead/agent/contactFlow/discoveryGuard";
import { expectedNoResponseDay1 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import type { ContactCheckContext } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  nextWeekdayDateKey,
  slotDateKey,
} from "~/server/speed2Lead/agent/testScenarios/dateUtils";
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

function snapshotAfterInbound(ctx: ContactCheckContext, inbound: string) {
  return ctx.turnSnapshots.find((snap) => snap.inbound === inbound);
}

const DIAGNOSTIC_QUESTION_MARKERS = [
  "when nobody can grab the call",
  "how quickly is someone usually able",
  "who's handling that follow-up",
  "what usually happens to that opportunity",
];

function looksLikeDiagnosticQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return DIAGNOSTIC_QUESTION_MARKERS.some((marker) => lower.includes(marker));
}

function inventedTimePattern(text: string): boolean {
  return /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(text) || /\b(monday|tuesday|wednesday|thursday|friday)\b.*\b\d{1,2}\b/i.test(text);
}

function allSlotsOnDate(
  session: ContactCheckContext["session"],
  expectedDateKey: string,
  timezone: string,
): CheckResult {
  const slots = session?.offeredSlots ?? [];
  if (slots.length === 0) {
    return { pass: false, detail: "No offeredSlots to validate for date filter" };
  }
  const wrong = slots.filter((slot) => slotDateKey(slot.startIso, timezone) !== expectedDateKey);
  if (wrong.length > 0) {
    return {
      pass: false,
      detail: `Slots include non-${expectedDateKey} times: ${wrong.map((s) => s.label).join("; ")}`,
    };
  }
  return { pass: true, detail: `All ${slots.length} slot(s) on ${expectedDateKey}` };
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

  /** Batch 2 — discovery cap and intent guards. */
  discoveryClosedAtCap(ctx) {
    const count = ctx.session?.discoveryQuestionCount ?? 0;
    if (count !== MAX_DISCOVERY_QUESTIONS) {
      return { pass: false, detail: `Expected discoveryQuestionCount=${MAX_DISCOVERY_QUESTIONS}; got ${count}` };
    }
    if (!ctx.session?.discoveryClosed) {
      return { pass: false, detail: "Expected discoveryClosed=true at cap" };
    }
    return { pass: true, detail: `discoveryQuestionCount=${count}, discoveryClosed=true` };
  },

  noThirdDiscoveryQuestion(ctx) {
    const reply = lastAssistant(ctx.transcript) ?? "";
    if (!ctx.session?.discoveryClosed) {
      return { pass: false, detail: "Discovery not closed before checking third-question block" };
    }
    if (looksLikeDiagnosticQuestion(reply) && reply.includes("?")) {
      return { pass: false, detail: `Model asked a third diagnostic question: ${reply.slice(0, 120)}` };
    }
    const schedulingPivot =
      /\b(what day|which time|works best|schedule|25-minute|quick chat)\b/i.test(reply);
    if (schedulingPivot || !reply.includes("?")) {
      return { pass: true, detail: "No third diagnostic question — scheduling pivot or statement" };
    }
    return {
      pass: false,
      detail: `Unexpected post-cap reply (possible third discovery Q): ${reply.slice(0, 120)}`,
    };
  },

  consequenceQuestionUsed(ctx) {
    const snap = ctx.turnSnapshots.at(-1);
    const reply = snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    if (isConsequenceQuestion(reply)) {
      return { pass: true, detail: "Consequence question detected in assistant reply" };
    }
    for (const message of ctx.transcript) {
      if (message.role === "assistant" && isConsequenceQuestion(message.content)) {
        return { pass: true, detail: "Consequence question found in transcript" };
      }
    }
    return { pass: false, detail: `Expected consequence question; got: ${reply.slice(0, 120)}` };
  },

  meetingAgreeOffersSlots(ctx) {
    const stage = ctx.session?.stage;
    const slots = ctx.session?.offeredSlots ?? [];
    if (stage !== "offering_slots" && stage !== "confirming" && stage !== "booked") {
      return { pass: false, detail: `Expected scheduling stage after agree; got ${stage ?? "null"}` };
    }
    if (slots.length === 0 && stage !== "booked") {
      return { pass: false, detail: "No offeredSlots after meeting agreement" };
    }
    return { pass: true, detail: `stage=${stage}, offered ${slots.length} slot(s)` };
  },

  pricingResponseCopySent(ctx) {
    const snap = ctx.turnSnapshots[0];
    const reply = snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    return reply === PRICING_RESPONSE_COPY
      ? { pass: true, detail: "Code-owned pricing copy sent" }
      : { pass: false, detail: `Expected pricing copy; got: ${reply.slice(0, 100)}` };
  },

  pricingResumesScheduling(ctx) {
    if (ctx.session?.pricingQuestionActive) {
      return { pass: false, detail: "pricingQuestionActive still true after resume turn" };
    }
    const stage = ctx.session?.stage;
    const slots = ctx.session?.offeredSlots ?? [];
    if (stage !== "offering_slots" && stage !== "confirming" && stage !== "booked") {
      return { pass: false, detail: `Expected scheduling stage after pricing resume; got ${stage ?? "null"}` };
    }
    if (slots.length === 0 && stage !== "booked") {
      return { pass: false, detail: "No offeredSlots after pricing resume" };
    }
    return { pass: true, detail: `Resumed scheduling: stage=${stage}, ${slots.length} slot(s)` };
  },

  /** Batch 3 — decline branching. */
  declineDiagnosisSent(ctx) {
    const snap = ctx.turnSnapshots[0];
    const reply = snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    const expected = buildDeclineDiagnosisQuestion();
    return reply === expected
      ? { pass: true, detail: "Decline diagnosis question sent" }
      : { pass: false, detail: `Expected diagnosis copy; got: ${reply.slice(0, 100)}` };
  },

  timingDeclineExit(ctx) {
    const reply = lastAssistant(ctx.transcript) ?? "";
    const expected = buildTimingDeclineExit();
    if (reply !== expected) {
      return { pass: false, detail: `Expected timing exit; got: ${reply}` };
    }
    if (ctx.session?.stage !== "declined") {
      return { pass: false, detail: `Expected stage=declined; got ${ctx.session?.stage ?? "null"}` };
    }
    return { pass: true, detail: "Timing decline exit with stage=declined" };
  },

  skepticismDeclineResponse(ctx) {
    const snap = ctx.turnSnapshots[1] ?? ctx.turnSnapshots.at(-1);
    const reply = snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    if (!reply.includes("90-day")) {
      return { pass: false, detail: `Expected skepticism guarantee copy; got: ${reply.slice(0, 120)}` };
    }
    if (snap?.session?.stage === "declined") {
      return { pass: false, detail: "Skepticism path exited too early — should re-engage" };
    }
    return { pass: true, detail: "Skepticism re-engage copy sent" };
  },

  secondDeclineExit(ctx) {
    const reply = lastAssistant(ctx.transcript) ?? "";
    if (reply !== buildTimingDeclineExit()) {
      return { pass: false, detail: `Expected terminal exit copy; got: ${reply.slice(0, 100)}` };
    }
    if (ctx.session?.stage !== "declined") {
      return { pass: false, detail: `Expected stage=declined after second decline; got ${ctx.session?.stage}` };
    }
    return { pass: true, detail: "Second decline produced terminal exit" };
  },

  /** Batch 4 — scheduling and booking. */
  slotsFromProviderShape(ctx) {
    const slots = ctx.session?.offeredSlots ?? [];
    if (slots.length === 0) {
      return { pass: false, detail: "No offeredSlots to validate" };
    }
    const bad = slots.filter((s) => !s.startIso || !s.label || Number.isNaN(Date.parse(s.startIso)));
    if (bad.length > 0) {
      return { pass: false, detail: `${bad.length} slot(s) missing valid ISO/label` };
    }
    return { pass: true, detail: `All ${slots.length} slots have ISO + label` };
  },

  slotSelectionAdvances(ctx) {
    const stage = ctx.session?.stage;
    if (stage === "confirming" || stage === "booked") {
      return { pass: true, detail: `stage=${stage} after slot selection` };
    }
    return { pass: false, detail: `Expected confirming/booked after slot pick; got ${stage ?? "null"}` };
  },

  contactFlowBooked(ctx) {
    if (ctx.session?.flow !== "contact") {
      return { pass: false, detail: `Expected flow=contact; got ${ctx.session?.flow ?? "null"}` };
    }
    if (ctx.session.stage !== "booked") {
      return { pass: false, detail: `Expected stage=booked; got ${ctx.session?.stage ?? "null"}` };
    }
    if (!ctx.session.bookedStartIso) {
      return { pass: false, detail: "Missing bookedStartIso after contact-flow booking" };
    }
    return {
      pass: true,
      detail: `Contact flow booked at ${ctx.session.bookedStartIso}`,
    };
  },

  fridaySlotsAfterDateChange(ctx) {
    const expected =
      (ctx.meta?.fridayDateKey as string | undefined) ??
      nextWeekdayDateKey("Friday", new Date(), getActiveProfile().timezone);
    const timezone = (ctx.meta?.timezone as string) ?? getActiveProfile().timezone;
    const snap = snapshotAfterInbound(ctx, "Then Friday");
    return allSlotsOnDate(snap?.session ?? ctx.session, expected, timezone);
  },

  noInventedTimesWhenUnavailable(ctx) {
    const slots = ctx.session?.offeredSlots ?? [];
    const last = lastAssistant(ctx.transcript) ?? "";
    if (slots.length > 0) {
      return { pass: true, detail: "Slots present — invention check not applicable" };
    }
    if (inventedTimePattern(last)) {
      return { pass: false, detail: "Reply names specific invented times without provider slots" };
    }
    return { pass: true, detail: "No specific invented times when calendar unavailable" };
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
