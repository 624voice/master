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
  looksLikeBridgeQuestion,
  MAX_DISCOVERY_QUESTIONS,
} from "~/server/speed2Lead/agent/contactFlow/discoveryGuard";
import { expectedNoResponseDay1 } from "~/server/speed2Lead/agent/contactFlow/testScenarios/seed";
import type { ContactCheckContext } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  nextWeekdayDateKey,
  slotDateKey,
  tomorrowDateKey,
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
      firstName: ctx.seed.firstName,
      businessName: ctx.seed.businessName ?? "Test Plumbing",
      inquiryClarity: "vague",
    });
    return opener === expected
      ? { pass: true, detail: "Vague opener matches template" }
      : { pass: false, detail: `Expected vague opener; got: ${opener}` };
  },
  vagueOpenerGrammar(ctx) {
    const opener = ctx.seed.messages?.[0]?.content ?? "";
    return opener.includes("What's prompting you to look into this now?")
      ? { pass: true, detail: "Vague opener uses fixed grammar" }
      : { pass: false, detail: `Garbled vague opener: ${opener}` };
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
      /\b(what day|which time|works best|schedule|25[- ]minute|quick chat|worth 25)\b/i.test(reply) ||
      looksLikeBridgeQuestion(reply);
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

  /** Batch 5 — Chris live-handset transcript regressions. */
  noOffTopicRedirectOnDiscoveryAnswer(ctx) {
    const inbound =
      "Not sure, we miss a few calls a week and when we call them back they've moved on";
    const snap = snapshotAfterInbound(ctx, inbound);
    const reply =
      snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    if (reply.includes("happy to pick that back up")) {
      return { pass: false, detail: "False off-topic redirect on legitimate discovery answer" };
    }
    return { pass: true, detail: "Discovery answer was not redirected as off-topic" };
  },

  tomorrowAdvancesScheduling(ctx) {
    const snap = snapshotAfterInbound(ctx, "Tomorrow");
    const session = snap?.session ?? ctx.session;
    const reply =
      snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    const expectedDate =
      (ctx.meta?.tomorrowDateKey as string | undefined) ??
      tomorrowDateKey(new Date(), getActiveProfile().timezone);

    if (!session?.requestedDate) {
      return { pass: false, detail: "Tomorrow did not set requestedDate" };
    }
    if (session.requestedDate !== expectedDate) {
      return {
        pass: false,
        detail: `requestedDate=${session.requestedDate}, expected ${expectedDate}`,
      };
    }
    if (reply.includes("What day or time range works best")) {
      return { pass: false, detail: "Full scheduling reset instead of accepting tomorrow" };
    }
    if (session.stage !== "offering_slots" && session.stage !== "confirming") {
      return { pass: false, detail: `Expected scheduling stage after tomorrow; got ${session.stage}` };
    }
    return { pass: true, detail: `Tomorrow parsed to ${session.requestedDate}, stage=${session.stage}` };
  },

  tomorrowAfternoonRetainsDate(ctx) {
    const snap = snapshotAfterInbound(ctx, "Tomorrow afternoon");
    const session = snap?.session ?? ctx.session;
    const expectedDate =
      (ctx.meta?.tomorrowDateKey as string | undefined) ??
      tomorrowDateKey(new Date(), getActiveProfile().timezone);

    if (session?.requestedDate !== expectedDate) {
      return {
        pass: false,
        detail: `Lost requestedDate after tomorrow afternoon: ${session?.requestedDate ?? "null"}`,
      };
    }
    if (session?.availabilityPreference !== "afternoon") {
      return {
        pass: false,
        detail: `Expected afternoon preference; got ${session?.availabilityPreference ?? "null"}`,
      };
    }
    return { pass: true, detail: "Tomorrow afternoon retained date + part-of-day" };
  },

  twoPmRetainsSchedulingState(ctx) {
    const snap = snapshotAfterInbound(ctx, "2pm");
    const session = snap?.session ?? ctx.session;
    const reply =
      snap?.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    const expectedDate =
      (ctx.meta?.tomorrowDateKey as string | undefined) ??
      tomorrowDateKey(new Date(), getActiveProfile().timezone);

    if (reply.includes("What day or time range works best")) {
      return { pass: false, detail: "Full scheduling reset after concrete 2pm time" };
    }
    if (session?.requestedDate !== expectedDate) {
      return {
        pass: false,
        detail: `Lost requestedDate after 2pm: ${session?.requestedDate ?? "null"}`,
      };
    }
    if (session?.stage !== "offering_slots" && session?.stage !== "confirming") {
      return { pass: false, detail: `Expected active scheduling stage after 2pm; got ${session?.stage}` };
    }
    return { pass: true, detail: `2pm retained scheduling state, stage=${session?.stage}` };
  },

  noInventedCalendarApology(ctx) {
    const badPhrases = ["don't have my calendar", "do not have my calendar", "calendar right now"];
    for (const snap of ctx.turnSnapshots) {
      const reply = snap.transcript.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
      const lower = reply.toLowerCase();
      if (badPhrases.some((phrase) => lower.includes(phrase))) {
        return { pass: false, detail: `LLM calendar apology leaked through: ${reply.slice(0, 120)}` };
      }
    }
    return { pass: true, detail: "No invented calendar-unavailable apology in transcript" };
  },

  resubmitBlockedWhileActive(ctx) {
    return ctx.crossFlowBlocked
      ? { pass: true, detail: "Second opener blocked while active session exists" }
      : { pass: false, detail: "Expected resubmit opener block on active session" };
  },

  /** Batch 6 — cost answer + scheduling availability regressions. */
  costAnswerProceedsWithoutRepeat(ctx) {
    const snap = snapshotAfterInbound(ctx, "Few thousand a month");
    const reply =
      snap?.transcript.filter((message) => message.role === "assistant").at(-1)?.content ?? "";
    if (isConsequenceQuestion(reply)) {
      return { pass: false, detail: `Repeated consequence question after cost answer: ${reply}` };
    }
    const stage = snap?.session?.stage ?? ctx.session?.stage;
    if (stage !== "bridge" && stage !== "offering_slots" && stage !== "confirming" && !ctx.session?.discoveryClosed) {
      return { pass: false, detail: `Expected bridge/scheduling after cost answer; got ${stage ?? "null"}` };
    }
    return { pass: true, detail: `Proceeded to ${stage} without consequence repeat` };
  },

  mondayBlockedOffersTuesday(ctx) {
    const expectedTuesday =
      (ctx.meta?.tuesdayDateKey as string | undefined) ??
      nextWeekdayDateKey("Tuesday", new Date(), getActiveProfile().timezone);
    const snap = snapshotAfterInbound(ctx, "Tuesday");
    const session = snap?.session ?? ctx.session;
    const reply =
      snap?.transcript.filter((message) => message.role === "assistant").at(-1)?.content ?? "";

    if (reply.includes("Nothing open in that window")) {
      return { pass: false, detail: "Still claiming nothing open after Tuesday request" };
    }
    if (session?.requestedDate !== expectedTuesday) {
      return {
        pass: false,
        detail: `Expected requestedDate=${expectedTuesday}; got ${session?.requestedDate ?? "null"}`,
      };
    }
    const slots = session?.offeredSlots ?? [];
    if (slots.length === 0) {
      return { pass: false, detail: "No Tuesday slots offered from partially-booked calendar fixture" };
    }
    const timezone = (ctx.meta?.timezone as string) ?? getActiveProfile().timezone;
    return allSlotsOnDate(session, expectedTuesday, timezone);
  },

  pricingMidSchedulingNotStuck(ctx) {
    const reply = lastAssistant(ctx.transcript) ?? "";
    if (reply.includes("Nothing open in that window")) {
      return { pass: false, detail: "Pricing question got scheduling availability fallback" };
    }
    return reply === PRICING_RESPONSE_COPY
      ? { pass: true, detail: "Code-owned pricing copy sent during active scheduling" }
      : { pass: false, detail: `Expected pricing copy; got: ${reply.slice(0, 100)}` };
  },

  /** Batch 7 — calendar failure + discovery ordering guards. */
  noFakeBookingOnCalendarFailure(ctx) {
    const last = lastAssistant(ctx.transcript) ?? "";
    const lower = last.toLowerCase();
    if (/\b(i('|')?ve|i have)\s+(booked|scheduled)\s+(you|us|that|it)\b/.test(lower)) {
      return { pass: false, detail: "Reply claims a completed booking after calendar failure" };
    }
    if (/\b(you'?re|you are)\s+(all set|confirmed|booked)\b/.test(lower)) {
      return { pass: false, detail: "Reply confirms booking without a real calendar event" };
    }
    if (ctx.session?.stage === "booked" && !ctx.session?.bookedEventId) {
      return { pass: false, detail: "Session marked booked without bookedEventId" };
    }
    return { pass: true, detail: "No fabricated booking language after calendar failure" };
  },

  noUnauthorizedMeetingPlatform(ctx) {
    const last = lastAssistant(ctx.transcript) ?? "";
    if (/\b(zoom|microsoft teams|webex)\b/i.test(last)) {
      return { pass: false, detail: "Reply names an LLM-invented meeting platform" };
    }
    return { pass: true, detail: "No unauthorized meeting platform in reply" };
  },

  schedulingFailureFlagged(ctx) {
    if (!ctx.session?.schedulingFailureAt) {
      return { pass: false, detail: "schedulingFailureAt not set after calendar failure" };
    }
    return {
      pass: true,
      detail: `Flagged at ${ctx.session.schedulingFailureAt} (${ctx.session.schedulingFailureReason ?? "unknown"})`,
    };
  },

  discoveryBeforeBookingAsk(ctx) {
    const assistantMessages = ctx.transcript.filter((m) => m.role === "assistant");
    const opener = assistantMessages[0]?.content ?? "";
    const secondReply = assistantMessages[1]?.content ?? "";
    if (!secondReply) {
      return { pass: false, detail: "No second assistant reply after opener response" };
    }
    const askedDiscovery =
      looksLikeDiagnosticQuestion(secondReply) ||
      isConsequenceQuestion(secondReply) ||
      looksLikeDiagnosticQuestion(opener);
    if (!askedDiscovery) {
      return { pass: false, detail: "No discovery/consequence question before bridge/scheduling" };
    }
    const lower = secondReply.toLowerCase();
    if (lower.includes("what day works best") && !askedDiscovery) {
      return { pass: false, detail: "Jumped straight to day ask without discovery" };
    }
    if (lower.includes("what day works best") && looksLikeBridgeQuestion(secondReply)) {
      return { pass: false, detail: "Combined bridge and day ask in one message" };
    }
    return { pass: true, detail: "Discovery/consequence asked before scheduling kickoff" };
  },

  atMostOneQuestionPerReply(ctx) {
    for (const message of ctx.transcript) {
      if (message.role !== "assistant") continue;
      const count = (message.content.match(/\?/g) ?? []).length;
      if (count > 1) {
        return {
          pass: false,
          detail: `Reply has ${count} questions: ${message.content.slice(0, 100)}`,
        };
      }
    }
    return { pass: true, detail: "Each assistant reply has at most one question mark" };
  },

  noCombinedBridgeAndDayAsk(ctx) {
    for (const message of ctx.transcript) {
      if (message.role !== "assistant") continue;
      const lower = message.content.toLowerCase();
      if (lower.includes("worth 25 minutes") && lower.includes("what day works best")) {
        return { pass: false, detail: "Bridge and day ask combined in one SMS" };
      }
    }
    return { pass: true, detail: "Bridge and day ask never combined" };
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
