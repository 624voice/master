import { buildPainPromptMessage } from "~/server/speed2Lead/agent/painPrompt";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import {
  listPendingNoResponsePhones,
  listPendingPainPromptPhones,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { isOptedOut } from "~/server/speed2Lead/session";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";
import type { ScenarioMessage } from "~/server/speed2Lead/agent/testScenarios/types";
import {
  slotDateKey,
  slotHour,
  slotWeekday,
  weekdayNameForDateKey,
} from "~/server/speed2Lead/agent/testScenarios/dateUtils";

export type TurnSnapshot = {
  turnIndex: number;
  inbound: string;
  session: AgentSession | null;
  transcript: ScenarioMessage[];
  outboundSms: Array<{ sid: string; body: string; sentAt: string | null }>;
};

export type CheckContext = {
  phone: string;
  session: AgentSession | null;
  transcript: ScenarioMessage[];
  turnSnapshots: TurnSnapshot[];
  meta: Record<string, unknown>;
  /** Outbound Twilio messages captured after scenario start (for STOP checks). */
  outboundSinceStart: Array<{ sid: string; body: string; sentAt: string | null }>;
  /** ISO timestamp recorded immediately before STOP inbound (scenario 3). */
  stopAt?: string;
};

export type CheckResult = {
  pass: boolean;
  detail: string;
};

export type MechanicalCheck = (ctx: CheckContext) => Promise<CheckResult> | CheckResult;

function painPromptSnippet(): string {
  const profile = getActiveProfile();
  return buildPainPromptMessage(profile).slice(0, 55).toLowerCase();
}

function assistantMessages(transcript: ScenarioMessage[]): string[] {
  return transcript.filter((m) => m.role === "assistant").map((m) => m.content);
}

function lastAssistantMessage(transcript: ScenarioMessage[]): string | null {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === "assistant") return transcript[i]!.content;
  }
  return null;
}

function countQuestionMarks(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function replyAsksDaypart(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\bmorning\b/.test(lower) &&
    /\b(afternoon|evening)\b/.test(lower) &&
    lower.includes("?")
  );
}

function allSlotsOnDate(session: AgentSession | null, expectedDateKey: string, timezone: string): CheckResult {
  const slots = session?.offeredSlots ?? [];
  if (slots.length === 0) {
    return { pass: false, detail: `No offeredSlots on session; expected all on ${expectedDateKey}` };
  }
  const mismatches = slots.filter((slot) => slotDateKey(slot.startIso, timezone) !== expectedDateKey);
  if (mismatches.length > 0) {
    return {
      pass: false,
      detail: `${mismatches.length}/${slots.length} slots not on ${expectedDateKey}: ${mismatches.map((s) => s.label).join("; ")}`,
    };
  }
  return { pass: true, detail: `All ${slots.length} offered slots are on ${expectedDateKey}` };
}

function slotsMatchWeekday(session: AgentSession | null, expectedDateKey: string, timezone: string): CheckResult {
  const expectedWeekday = weekdayNameForDateKey(expectedDateKey, timezone);
  const slots = session?.offeredSlots ?? [];
  if (slots.length === 0) {
    return { pass: false, detail: "No offeredSlots to verify weekday alignment" };
  }
  const bad = slots.filter((slot) => slotWeekday(slot.startIso, timezone) !== expectedWeekday);
  if (bad.length > 0) {
    return {
      pass: false,
      detail: `Expected weekday ${expectedWeekday}; mismatched: ${bad.map((s) => s.label).join("; ")}`,
    };
  }
  return { pass: true, detail: `All slots fall on ${expectedWeekday}` };
}

export const MECHANICAL_CHECKS: Record<string, MechanicalCheck> = {
  /** Scenario 1 — "not sure" is not treated as pain identification or meeting agreement. */
  async notSureNotAgreement(ctx) {
    const session = ctx.session;
    if (!session) return { pass: false, detail: "No session after turn" };
    if (session.stage === "offering_slots" || session.stage === "confirming" || session.stage === "booked") {
      return { pass: false, detail: `Stage advanced to ${session.stage} — "not sure" should not trigger meeting flow` };
    }
    if (session.primaryPain && session.primaryPain !== "general") {
      return { pass: false, detail: `primaryPain set to ${session.primaryPain} from uncertain reply` };
    }
    return { pass: true, detail: `Stage=${session.stage}, primaryPain=${session.primaryPain ?? "unset"}` };
  },

  notSureNoVerbatimPainReask(ctx) {
    const last = lastAssistantMessage(ctx.transcript);
    if (!last) return { pass: false, detail: "No assistant reply recorded" };
    const snippet = painPromptSnippet();
    if (last.toLowerCase().includes(snippet)) {
      return { pass: false, detail: "Assistant re-asked the identical pain-prompt question verbatim" };
    }
    const fullPrompt = buildPainPromptMessage(getActiveProfile()).trim();
    if (last.trim() === fullPrompt) {
      return { pass: false, detail: "Assistant repeated full pain-prompt message verbatim" };
    }
    return { pass: true, detail: "Did not repeat pain-prompt verbatim" };
  },

  notSureFollowUpPresent(ctx) {
    const last = lastAssistantMessage(ctx.transcript);
    if (!last) return { pass: false, detail: "No assistant reply" };
    const hasQuestion = last.includes("?");
    const isSubstantive = last.trim().length >= 20;
    if (!hasQuestion && !isSubstantive) {
      return { pass: false, detail: "Reply neither asks a clarifying question nor advances with substance" };
    }
    return { pass: true, detail: "Assistant reply includes clarifying question or substantive forward motion" };
  },

  /** Scenario 2 — meeting decline handling. */
  declineFirstTurnNotTerminal(ctx) {
    const snap = ctx.turnSnapshots[0];
    const stage = snap?.session?.stage;
    if (!stage) return { pass: false, detail: "No session after first decline" };
    if (stage === "declined") {
      return { pass: false, detail: "stage=declined after first decline (expected one overcome first)" };
    }
    return { pass: true, detail: `After first decline stage=${stage}` };
  },

  declineFirstTurnOvercome(ctx) {
    const reply = ctx.turnSnapshots[0]?.transcript.filter((m) => m.role === "assistant").at(-1)?.content;
    if (!reply) return { pass: false, detail: "No assistant reply after first decline" };
    const lower = reply.toLowerCase();
    const pushesMeeting =
      lower.includes("minute") ||
      lower.includes("worth") ||
      lower.includes("quick call") ||
      lower.includes("25") ||
      lower.includes("meeting");
    if (!pushesMeeting) {
      return { pass: false, detail: "First-decline reply lacks a brief meeting counter-argument" };
    }
    return { pass: true, detail: "First-decline reply includes a meeting counter-argument" };
  },

  declineSecondTurnTerminal(ctx) {
    const stage = ctx.session?.stage;
    if (stage !== "declined") {
      return { pass: false, detail: `Expected stage=declined after second decline; got ${stage ?? "null"}` };
    }
    return { pass: true, detail: "stage=declined after second decline" };
  },

  declineNoReplyAfterSecond(ctx) {
    const assistantCount = assistantMessages(ctx.transcript).length;
    // bridge seed has 1 assistant + first overcome + optional second reply = max 3
    const userTurns = ctx.transcript.filter((m) => m.role === "user").length;
    if (userTurns < 2) {
      return { pass: false, detail: "Expected two user turns for decline chain" };
    }
    // After 2 user messages we should have at most 2 new assistant replies (overcome + surrender)
    const bridgeAssistantCount = 2; // bridge question + maybe pain path
    const newAssistant = assistantCount - bridgeAssistantCount;
    if (newAssistant > 2) {
      return { pass: false, detail: `Too many assistant replies after declines (${newAssistant})` };
    }
    const last = lastAssistantMessage(ctx.transcript)?.toLowerCase() ?? "";
    if (last.includes("?") && (last.includes("worth") || last.includes("minute"))) {
      return { pass: false, detail: "Final reply still pushes meeting after second decline" };
    }
    return { pass: true, detail: "No third meeting push detected after second decline" };
  },

  /** Scenario 3 — STOP handling. */
  async stopOptedOut(ctx) {
    const opted = await isOptedOut(ctx.phone);
    return opted
      ? { pass: true, detail: "Phone marked opted_out" }
      : { pass: false, detail: "Phone not marked opted_out" };
  },

  async stopDequeuedPainPrompt(ctx) {
    const pending = await listPendingPainPromptPhones();
    const normalized = normalizePhone(ctx.phone);
    const stillQueued = pending.includes(normalized);
    return stillQueued
      ? { pass: false, detail: "Still on pain-prompt pending set" }
      : { pass: true, detail: "Removed from pain-prompt pending set" };
  },

  async stopDequeuedNoResponse(ctx) {
    const pending = await listPendingNoResponsePhones();
    const normalized = normalizePhone(ctx.phone);
    const stillQueued = pending.includes(normalized);
    return stillQueued
      ? { pass: false, detail: "Still on no-response pending set" }
      : { pass: true, detail: "Removed from no-response pending set" };
  },

  async stopDequeuedNurture(ctx) {
    const redis = getRedis();
    const pending = ((await redis.smembers("speed2lead:nurture-followups")) as string[] | null) ?? [];
    const normalized = normalizePhone(ctx.phone);
    const stillQueued = pending.includes(normalized);
    return stillQueued
      ? { pass: false, detail: "Still on legacy nurture-followups set" }
      : { pass: true, detail: "Not on nurture-followups set" };
  },

  stopNoOutboundAfterStop(ctx) {
    if (!ctx.stopAt) {
      return { pass: false, detail: "stopAt timestamp missing from harness context" };
    }
    const stopMs = new Date(ctx.stopAt).getTime();
    const afterStop = ctx.outboundSinceStart.filter(
      (m) => m.sentAt && new Date(m.sentAt).getTime() > stopMs,
    );
    if (afterStop.length > 0) {
      return {
        pass: false,
        detail: `${afterStop.length} outbound SMS after STOP: ${afterStop.map((m) => m.body.slice(0, 60)).join(" | ")}`,
      };
    }
    return { pass: true, detail: "No outbound SMS observed after STOP" };
  },

  stopNoAssistantTranscriptAfterStop(ctx) {
    if (!ctx.stopAt) return { pass: false, detail: "stopAt missing" };
    const stopMs = new Date(ctx.stopAt).getTime();
    const session = ctx.session;
    if (!session) return { pass: true, detail: "No session persisted after STOP (expected)" };
    const appendedAfter = session.messages.filter(
      (m) => m.role === "assistant" && new Date(m.at).getTime() > stopMs,
    );
    if (appendedAfter.length > 0) {
      return {
        pass: false,
        detail: `Session transcript has ${appendedAfter.length} assistant message(s) after STOP`,
      };
    }
    return { pass: true, detail: "No assistant transcript entries after STOP" };
  },

  /** Scenario 4 — date resolution (meta.expectedDateKey required). */
  dateAllSlotsOnExpectedDay(ctx) {
    const expected = ctx.meta.expectedDateKey as string | undefined;
    const timezone = (ctx.meta.timezone as string) ?? getActiveProfile().timezone;
    if (!expected) return { pass: false, detail: "meta.expectedDateKey not set" };
    return allSlotsOnDate(ctx.session, expected, timezone);
  },

  dateSlotsMatchExpectedWeekday(ctx) {
    const expected = ctx.meta.expectedDateKey as string | undefined;
    const timezone = (ctx.meta.timezone as string) ?? getActiveProfile().timezone;
    if (!expected) return { pass: false, detail: "meta.expectedDateKey not set" };
    return slotsMatchWeekday(ctx.session, expected, timezone);
  },

  dateReplyMentionsExpectedDay(ctx) {
    const expected = ctx.meta.expectedDateKey as string | undefined;
    const timezone = (ctx.meta.timezone as string) ?? getActiveProfile().timezone;
    if (!expected) return { pass: false, detail: "meta.expectedDateKey not set" };
    const weekday = weekdayNameForDateKey(expected, timezone);
    const last = lastAssistantMessage(ctx.transcript)?.toLowerCase() ?? "";
    const slots = ctx.session?.offeredSlots ?? [];
    const labelHit = slots.some((s) => s.label.toLowerCase().includes(weekday.toLowerCase()));
    const replyHit = last.includes(weekday.toLowerCase());
    if (!labelHit && !replyHit && slots.length === 0) {
      return { pass: false, detail: `No slots or reply mention expected weekday ${weekday}` };
    }
    if (slots.length > 0) {
      return slotsMatchWeekday(ctx.session, expected, timezone);
    }
    return replyHit
      ? { pass: true, detail: `Reply references ${weekday}` }
      : { pass: false, detail: `Reply does not reference expected weekday ${weekday}` };
  },

  /** Scenario 5 — daypart filtering. */
  daypartMorningSlots(ctx) {
    const timezone = (ctx.meta.timezone as string) ?? getActiveProfile().timezone;
    const slots = ctx.session?.offeredSlots ?? [];
    if (slots.length === 0) {
      return { pass: false, detail: "No offeredSlots after morning preference" };
    }
    const afternoon = slots.filter((s) => slotHour(s.startIso, timezone) >= 12);
    if (afternoon.length > 0) {
      return {
        pass: false,
        detail: `${afternoon.length} slot(s) at/after noon: ${afternoon.map((s) => s.label).join("; ")}`,
      };
    }
    return { pass: true, detail: `All ${slots.length} slots before noon (${timezone})` };
  },

  daypartAfternoonSlots(ctx) {
    const timezone = (ctx.meta.timezone as string) ?? getActiveProfile().timezone;
    const slots = ctx.session?.offeredSlots ?? [];
    if (slots.length === 0) {
      return { pass: false, detail: "No offeredSlots after afternoon preference" };
    }
    const morning = slots.filter((s) => slotHour(s.startIso, timezone) < 12);
    if (morning.length > 0) {
      return {
        pass: false,
        detail: `${morning.length} morning slot(s): ${morning.map((s) => s.label).join("; ")}`,
      };
    }
    return { pass: true, detail: `All ${slots.length} slots at/after noon (${timezone})` };
  },

  daypartAnytimeNoClarify(ctx) {
    const last = lastAssistantMessage(ctx.transcript);
    if (!last) return { pass: false, detail: "No assistant reply" };
    if (replyAsksDaypart(last)) {
      return { pass: false, detail: "Reply asks morning vs afternoon clarifying question" };
    }
    const lower = last.toLowerCase();
    if (lower.includes("morning or afternoon") || lower.includes("morning vs afternoon")) {
      return { pass: false, detail: "Reply explicitly asks morning/afternoon preference" };
    }
    return { pass: true, detail: "No daypart clarifying question in reply" };
  },

  daypartAnytimeOffersSlots(ctx) {
    const slots = ctx.session?.offeredSlots ?? [];
    if (slots.length === 0) {
      return { pass: false, detail: "No slots offered after anytime preference" };
    }
    return { pass: true, detail: `Offered ${slots.length} slot(s) without daypart gate` };
  },
};

export async function runMechanicalChecks(
  checkIds: string[],
  ctx: CheckContext,
): Promise<Record<string, CheckResult>> {
  const results: Record<string, CheckResult> = {};
  for (const id of checkIds) {
    const fn = MECHANICAL_CHECKS[id];
    if (!fn) {
      results[id] = { pass: false, detail: `Unknown check id: ${id}` };
      continue;
    }
    results[id] = await fn(ctx);
  }
  return results;
}

export function summarizeChecks(results: Record<string, CheckResult>): {
  pass: boolean;
  passed: string[];
  failed: string[];
} {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const [id, result] of Object.entries(results)) {
    if (result.pass) passed.push(id);
    else failed.push(`${id}: ${result.detail}`);
  }
  return { pass: failed.length === 0, passed, failed };
}
