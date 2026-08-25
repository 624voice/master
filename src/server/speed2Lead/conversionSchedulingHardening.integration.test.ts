import { describe, expect, test, beforeEach } from "bun:test";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { buildSchedulingRequestKey } from "~/server/scheduling/requestKey";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import { resolveRangeForRequest } from "~/server/scheduling/rangeResolver";
import { getConsultationBusinessHours, getConsultationDurationMinutes } from "~/server/appointmentLifecycle/consultationConfig";
import { mergeIntentIntoState, parseSchedulingIntentUpdate } from "~/server/scheduling/intentParser";
import { toCanonicalSchedulingState } from "~/server/scheduling/state";
import { isDiscoveryTaskBlocked } from "~/server/speed2Lead/conversationStage";
import {
  buildBookingConfirmationMessage,
  finalizeCalendarLinkOutbound,
  validateOutboundSms,
} from "~/server/speed2Lead/guardrails";
import { detectSchedulingRefinement } from "~/server/speed2Lead/schedulingContext";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingGate";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import { buildContactSession } from "~/server/speed2Lead/eval/scenarios";
import type { ContactConversationContext, ConversationContext } from "~/server/speed2Lead/types";
import { contactOpening } from "~/server/speed2Lead/messages";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 21, 10, 0, TZ);
const phone = "+15559876543";
const meetUrl = "https://meet.google.com/test-abc-defg-hij";

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

  test("evenings work better maps to evening preference", () => {
    const patch = parseSchedulingIntentUpdate("Evenings work better", { status: "idle" }, now);
    expect(patch.availabilityPreference).toBe("evening");
    const merged = mergeIntentIntoState({ status: "idle" }, patch);
    expect(merged.partOfDay).toBe("evening");
  });

  test("around 7 sets anchor and evening without requiring date", () => {
    const prior = mergeIntentIntoState(
      { status: "idle" },
      parseSchedulingIntentUpdate("Evenings work better", { status: "idle" }, now),
    );
    const patch = parseSchedulingIntentUpdate("Around 7", prior, now);
    expect(patch.anchorTime).toBe(19 * 60);
    const merged = mergeIntentIntoState(prior, patch);
    expect(merged.availabilityPreference).toBe("evening");
    expect(merged.anchorTimeMinutes).toBe(19 * 60);
  });

  test("Friday pivot preserves evening and anchor", () => {
    let state = mergeIntentIntoState(
      { status: "idle" },
      parseSchedulingIntentUpdate("Evenings work better", { status: "idle" }, now),
    );
    state = mergeIntentIntoState(state, parseSchedulingIntentUpdate("Around 7", state, now));
    const pivot = parseSchedulingIntentUpdate("Actually what about Friday instead", state, now);
    expect(pivot.requestedDate).toBe("2026-08-28");
    expect(pivot.availabilityPreference).toBeUndefined();
    const merged = mergeIntentIntoState(state, pivot);
    expect(merged.availabilityPreference).toBe("evening");
    expect(merged.anchorTimeMinutes).toBe(19 * 60);
    expect(merged.requestedDate).toBe("2026-08-28");
  });

  test("request keys distinguish evening, around anchor, and full day", () => {
    const businessHours = getConsultationBusinessHours();
    const duration = getConsultationDurationMinutes();
    const base = {
      timezone: TZ,
      requestedDate: "2026-08-28",
      businessHours,
      meetingDurationMinutes: duration,
    };
    const evening = buildSchedulingRequestKey({ ...base, availabilityPreference: "evening" });
    const around = buildSchedulingRequestKey({
      ...base,
      availabilityPreference: "evening",
      anchorTime: 19 * 60,
    });
    const fullDay = buildSchedulingRequestKey({ ...base, availabilityPreference: "full_day" });
    expect(evening).not.toBe(around);
    expect(evening).not.toBe(fullDay);
    expect(around).toContain("anchor:1140");
  });

  test("anchor query range covers 7pm slot", () => {
    const resolved = resolveRangeForRequest(
      {
        timezone: TZ,
        requestedDate: "2026-08-28",
        availabilityPreference: "evening",
        anchorTime: 19 * 60,
        businessHours: getConsultationBusinessHours(),
        meetingDurationMinutes: getConsultationDurationMinutes(),
      },
      now,
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    const endParts = parseCentralParts(resolved.rangeEnd, TZ);
    expect(endParts.hour * 60 + endParts.minute).toBeGreaterThanOrEqual(19 * 60);
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

  test("evening-friday scenario plans provider fetch on Friday pivot", () => {
    let context = roiSession({
      messages: [
        {
          role: "assistant",
          content:
            "If I showed you a way to take manual follow-up off your team, would it be worth 25 minutes to see how it works?",
        },
      ],
    });
    context = {
      ...context,
      knownFacts: { ...context.knownFacts!, meetingInterestConfirmed: true },
    };
    for (const message of ["Evenings work better", "Around 7"]) {
      const patch = parseSchedulingIntentUpdate(message, toCanonicalSchedulingState(context.scheduling), now);
      const merged = mergeIntentIntoState(toCanonicalSchedulingState(context.scheduling), patch);
      context = {
        ...context,
        scheduling: {
          ...context.scheduling,
          ...merged,
          status: "idle",
        },
      };
    }
    const plan = planSchedulingGate({
      inboundMessage: "Actually what about Friday instead",
      context,
      now,
    });
    expect(["get_availability", "get_availability_for_request"]).toContain(
      plan.action.type === "get_availability" || plan.action.type === "get_availability_for_request"
        ? plan.action.type
        : plan.action.type,
    );
    if (plan.action.type === "get_availability" || plan.action.type === "get_availability_for_request") {
      expect(plan.action.input.centralDate).toBe("2026-08-28");
    }
  });

  test("contact contextual pain does not enter scheduling", () => {
    const session = buildContactSession(now, phone) as ContactConversationContext;
    const plan = planSchedulingGate({
      inboundMessage: "Yes after hours is the main issue for us",
      context: session,
      now,
    });
    expect(plan.schedulingIntent).toBe(false);
    expect(plan.action.type).toBe("none");
  });

  test("vague ROI response does not enter scheduling", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Not sure honestly",
      context: roiSession({
        knownFacts: {
          firstName: "Alex",
          phone,
          flow: "roi",
          meetingInterestConfirmed: false,
          diagnosticQuestionsAsked: 0,
          discoveryPhase: "report_reaction",
        },
      }),
      now,
    });
    expect(plan.schedulingIntent).toBe(false);
  });

  test("booked Meet URL survives outbound policy and guardrails", () => {
    const context = roiSession({
      scheduling: {
        status: "confirmed",
        googleMeetUrl: meetUrl,
        selectedStart: slot("2026-08-25", 14, 0),
      },
    });
    const confirmation = buildBookingConfirmationMessage(slot("2026-08-25", 14, 0), "Alex", {
      context,
      meetingLink: meetUrl,
    });
    expect(confirmation).toContain(meetUrl);

    const finalized = finalizeCalendarLinkOutbound(confirmation, context, false);
    expect(finalized).toContain(meetUrl);

    const validated = validateOutboundSms(finalized!, {
      session: context,
      toolState: { ...createInitialToolState(), bookingConfirmed: true, bookingStart: slot("2026-08-25", 14, 0) },
      calendarLinkAllowed: false,
      allowProspectName: true,
    });
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.text).toContain(meetUrl);
    }
  });

  test("generic calendar fallback link is still stripped", () => {
    const context = roiSession();
    const text = `Use this link: ${context.bookingUrl}`;
    const finalized = finalizeCalendarLinkOutbound(text, context, false);
    expect(finalized).not.toContain("calendar.app.google");
  });

  test("vague provisional booking language is blocked", () => {
    const result = validateOutboundSms("Noon-ish it is — I'll confirm shortly.", {
      session: roiSession(),
      toolState: createInitialToolState(),
    });
    expect(result.ok).toBe(false);
  });

  test("fake async scheduling language is blocked", () => {
    for (const text of [
      "I'll reach out soon to get this on the calendar.",
      "I'll send details shortly.",
    ]) {
      const result = validateOutboundSms(text, {
        session: roiSession(),
        toolState: createInitialToolState(),
      });
      expect(result.ok).toBe(false);
    }
  });
});
