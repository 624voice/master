import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  detectRepetitionCorrection,
  detectSchedulingRefinement,
  extractRequestedTimeMinutes,
  mergeSchedulingIntentFromMessage,
} from "~/server/speed2Lead/schedulingContext";
import {
  planSchedulingGate,
  resolveOfferedSlotSelection,
} from "~/server/speed2Lead/schedulingController";
import type { ConversationContext } from "~/server/speed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone: "+15551234567",
    firstName: "Chris",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Chris",
      phone: "+15551234567",
      flow: "roi",
      businessName: "Test Plumbing",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function tuesdayAfternoonSlots(): string[] {
  return [
    centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
    centralDateAt(2026, 8, 26, 12, 15, TZ).toISOString(),
    centralDateAt(2026, 8, 26, 12, 30, TZ).toISOString(),
  ];
}

describe("scheduling conversation hardening", () => {
  test("1230 is good selects previously offered 12:30 slot", () => {
    const slots = tuesdayAfternoonSlots();
    expect(resolveOfferedSlotSelection("1230 is good", slots)).toBe(slots[2]);
    const plan = planSchedulingGate({
      inboundMessage: "1230 is good",
      context: roiSession({ scheduling: { status: "slots_offered", offeredSlots: slots } }),
      now,
    });
    expect(plan.action.type).toBe("book_appointment");
  });

  test("compact and natural slot selection forms resolve", () => {
    const slots = [
      centralDateAt(2026, 8, 26, 9, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 10, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 11, 30, TZ).toISOString(),
    ];
    expect(
      resolveOfferedSlotSelection("12:30 works", [
        centralDateAt(2026, 8, 26, 12, 30, TZ).toISOString(),
      ]),
    ).toBeTruthy();
    expect(resolveOfferedSlotSelection("the last one", slots)).toBe(slots[2]);
    expect(resolveOfferedSlotSelection("second one", slots)).toBe(slots[1]);
    expect(resolveOfferedSlotSelection("that works", [slots[0]!])).toBe(slots[0]);
  });

  test("Tuesday established then afternoon preserves Tuesday in refinement", () => {
    const merged = mergeSchedulingIntentFromMessage(
      { status: "idle", centralDate: "2026-08-26" },
      "What do you have in the afternoon",
      now,
    );
    expect(merged.partOfDay).toBe("afternoon");
    expect(merged.centralDate).toBeUndefined();
  });

  test("Need something later plans fresh later availability on same day", () => {
    const slots = tuesdayAfternoonSlots();
    const plan = planSchedulingGate({
      inboundMessage: "Need something later",
      context: roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: slots,
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
    expect(plan.action.type === "get_availability_for_request" && plan.action.reason).toBe(
      "refine_later",
    );
  });

  test("you already asked me that cannot trigger ask_preference again", () => {
    const plan = planSchedulingGate({
      inboundMessage: "You already asked me that",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, urgency: "high", fit: "yes" },
        scheduling: {
          status: "slots_offered",
          offeredSlots: tuesdayAfternoonSlots(),
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      now,
    });
    expect(plan.action.type).not.toBe("ask_preference");
    expect(plan.action.type).toBe("get_availability");
  });

  test("known day and part-of-day prevent ask_preference", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Yep",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, urgency: "high", fit: "yes" },
        scheduling: {
          status: "idle",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      now,
    });
    expect(plan.action.type).not.toBe("ask_preference");
  });

  test("extractRequestedTimeMinutes handles compact and spaced forms", () => {
    expect(extractRequestedTimeMinutes("1230 is good")).toBe(12 * 60 + 30);
    expect(extractRequestedTimeMinutes("12 30 works")).toBe(12 * 60 + 30);
    expect(extractRequestedTimeMinutes("930")).toBe(9 * 60 + 30);
  });

  test("detectRepetitionCorrection catches natural correction phrases", () => {
    expect(detectRepetitionCorrection("You already asked me that")).toBe(true);
    expect(detectRepetitionCorrection("I already told you Tuesday")).toBe(true);
  });

  test("detectSchedulingRefinement handles relative language", () => {
    const slots = tuesdayAfternoonSlots();
    const scheduling = {
      status: "slots_offered" as const,
      offeredSlots: slots,
      centralDate: "2026-08-26",
      partOfDay: "afternoon" as const,
    };
    expect(detectSchedulingRefinement("anything earlier?", scheduling, slots, now)?.reason).toBe(
      "refine_earlier",
    );
    expect(detectSchedulingRefinement("after 2", scheduling, slots, now)?.reason).toBe(
      "refine_anchor_time",
    );
    expect(detectSchedulingRefinement("closer to 3", scheduling, slots, now)?.reason).toBe(
      "refine_anchor_time",
    );
    expect(detectSchedulingRefinement("morning instead", scheduling, slots, now)?.reason).toBe(
      "refine_part_of_day",
    );
    expect(detectSchedulingRefinement("actually Wednesday", scheduling, slots, now)?.reason).toBe(
      "refine_change_day",
    );
  });
});

describe("live phone regression sequence", () => {
  test("1230 is good books offered slot after Tuesday afternoon offers", () => {
    const slots = tuesdayAfternoonSlots();

    let session = roiSession();
    for (const message of [
      "Prob missed calls",
      "No, just answering the phones",
      "Yep",
      "How about next Tuesday",
      "What do you have in the afternoon",
    ]) {
      const plan = planSchedulingGate({ inboundMessage: message, context: session, now });
      if (
        plan.action.type === "get_availability" ||
        plan.action.type === "get_availability_for_request"
      ) {
        session = {
          ...session,
          scheduling: {
            ...session.scheduling,
            status: "slots_offered",
            offeredSlots: slots,
            centralDate: plan.preferenceInput?.centralDate ?? session.scheduling?.centralDate,
            partOfDay: plan.preferenceInput?.partOfDay ?? session.scheduling?.partOfDay,
          },
        };
      }
    }

    const bookingPlan = planSchedulingGate({
      inboundMessage: "1230 is good",
      context: {
        ...session,
        scheduling: {
          status: "slots_offered",
          offeredSlots: slots,
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      },
      now,
    });
    expect(bookingPlan.action.type).toBe("book_appointment");
    expect(bookingPlan.action.type === "book_appointment" && bookingPlan.action.start).toBe(
      slots[2],
    );
  });

  test("Need something later keeps Tuesday afternoon context", () => {
    const slots = tuesdayAfternoonSlots();
    const plan = planSchedulingGate({
      inboundMessage: "Need something later",
      context: roiSession({
        scheduling: {
          status: "slots_offered",
          offeredSlots: slots,
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        },
      }),
      now,
    });
    expect(plan.action.type).toBe("get_availability_for_request");
    expect(plan.preferenceInput?.centralDate).toBe("2026-08-26");
    expect(plan.preferenceInput?.partOfDay).toBe("afternoon");
  });
});
