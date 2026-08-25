import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { buildSchedulingRequestKey } from "~/server/scheduling/requestKey";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import { getConsultationBusinessHours, getConsultationDurationMinutes } from "~/server/appointmentLifecycle/consultationConfig";
import { parseSchedulingIntentUpdate } from "~/server/scheduling/intentParser";
import { isDiscoveryTaskBlocked } from "~/server/speed2Lead/conversationStage";
import { validateOutboundSms } from "~/server/speed2Lead/guardrails";
import { detectSchedulingRefinement } from "~/server/speed2Lead/schedulingContext";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingGate";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const phone = "+15559876543";

function slot(date: string, hour: number, minute = 0): string {
  const [year, month, day] = date.split("-").map(Number);
  return centralDateAt(year!, month!, day!, hour, minute, TZ).toISOString();
}

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone,
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone,
      flow: "roi",
      meetingInterestConfirmed: true,
      diagnosticQuestionsAsked: 1,
      discoveryPhase: "scheduling",
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.SPEED2LEAD_LLM_ENABLED = "true";
});

describe("conversion + scheduling hardening regression", () => {
  test("discovery tasks blocked after meeting interest", () => {
    const ctx = roiSession();
    expect(isDiscoveryTaskBlocked(ctx, "ask_one_operational_followup")).toBe(true);
    expect(isDiscoveryTaskBlocked(ctx, "brief_active_conversation")).toBe(false);
  });

  test("directional bounds: after 3, before noon, between 2 and 4, around 4", () => {
    const after3 = parseSchedulingIntentUpdate("after 3", { status: "idle" }, now);
    expect(after3.lowerTimeBound).toBe(15 * 60);

    const beforeNoon = parseSchedulingIntentUpdate("before noon", { status: "idle" }, now);
    expect(beforeNoon.upperTimeBound).toBe(12 * 60);

    const between = parseSchedulingIntentUpdate("between 2 and 4", { status: "idle" }, now);
    expect(between.lowerTimeBound).toBe(14 * 60);
    expect(between.upperTimeBound).toBe(16 * 60);

    const around = parseSchedulingIntentUpdate("around 4", { status: "idle" }, now);
    expect(around.anchorTime).toBe(16 * 60);
  });

  test("late morning and late afternoon map to canonical bounds", () => {
    const lateMorning = parseSchedulingIntentUpdate("late morning", { status: "idle" }, now);
    expect(lateMorning.availabilityPreference).toBe("morning");
    expect(lateMorning.lowerTimeBound).toBe(10 * 60);

    const lateAfternoon = parseSchedulingIntentUpdate("late afternoon", { status: "idle" }, now);
    expect(lateAfternoon.availabilityPreference).toBe("afternoon");
    expect(lateAfternoon.lowerTimeBound).toBe(14 * 60);
  });

  test("request key changes when bounds change", () => {
    const base = {
      timezone: TZ,
      requestedDate: "2026-08-27",
      availabilityPreference: "morning" as const,
      businessHours: getConsultationBusinessHours(),
      meetingDurationMinutes: getConsultationDurationMinutes(),
    };
    const a = buildSchedulingRequestKey(base);
    const b = buildSchedulingRequestKey({ ...base, lowerTimeBound: 10 * 60 });
    expect(a).not.toBe(b);
  });

  test("filter ranks around anchor closest slots", () => {
    const raw = [slot("2026-08-27", 15, 0), slot("2026-08-27", 16, 0), slot("2026-08-27", 17, 0)];
    const filtered = filterAndRankSlots({
      rawSlots: raw,
      request: {
        timezone: TZ,
        requestedDate: "2026-08-27",
        availabilityPreference: "afternoon",
        anchorTime: 16 * 60,
        businessHours: getConsultationBusinessHours(),
        meetingDurationMinutes: getConsultationDurationMinutes(),
      },
    });
    expect(filtered[0]).toBe(slot("2026-08-27", 16, 0));
  });

  test("later that morning preserves morning daypart in refinement", () => {
    const offered = [slot("2026-08-27", 9, 0), slot("2026-08-27", 9, 45), slot("2026-08-27", 10, 30)];
    const refinement = detectSchedulingRefinement(
      "Anything later that morning?",
      {
        status: "slots_offered",
        centralDate: "2026-08-27",
        partOfDay: "morning",
        offeredSlots: offered,
      },
      offered,
      now,
    );
    expect(refinement?.input.partOfDay).toBe("morning");
    expect(refinement?.reason).toBe("refine_later_morning");
  });

  test("date clarification plans customer question not availability fetch", () => {
    const plan = planSchedulingGate({
      inboundMessage: "We're talking about the 27th right?",
      context: roiSession({
        scheduling: {
          status: "slots_offered",
          centralDate: "2026-08-27",
          partOfDay: "morning",
          offeredSlots: [slot("2026-08-27", 9, 0)],
        },
      }),
      now,
    });
    expect(plan.action.type).toBe("answer_customer_question");
  });

  test("vague provisional booking language is blocked", () => {
    const result = validateOutboundSms("Noon-ish it is — I'll confirm shortly.", {
      session: roiSession(),
      toolState: createInitialToolState(),
    });
    expect(result.ok).toBe(false);
  });
});
