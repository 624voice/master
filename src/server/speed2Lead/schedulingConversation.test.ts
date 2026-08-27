import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  detectDaypartSelectionCorrection,
  detectRepetitionCorrection,
  detectSchedulingConstraints,
  detectSchedulingRefinement,
  extractRequestedTimeMinutes,
  mergeSchedulingIntentFromMessage,
  messageHasResolvedDayWithoutPartOfDay,
  normalizeSchedulingStateConstraints,
  offeredSlotConstraintKey,
} from "~/server/speed2Lead/schedulingContext";
import { buildContextualSlotOfferMessage } from "~/server/speed2Lead/schedulingReply";
import { applyOfferedSlots } from "~/server/speed2Lead/memory";
import { rankSlotsForOffer, slotStartMinutes } from "~/server/speed2Lead/slotRanking";
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

  test("morning rejection excludes morning slots and preserves afternoon", () => {
    const patch = detectSchedulingConstraints("Morning doesn't work for me", {
      status: "slots_offered",
      centralDate: "2026-08-26",
      partOfDay: "full_day",
    });
    expect(patch.rejectedPartOfDay).toContain("morning");
    expect(patch.partOfDay).toBe("afternoon");

    const allSlots = [
      centralDateAt(2026, 8, 26, 9, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];
    const ranked = rankSlotsForOffer(allSlots, {
      rejectedPartOfDay: ["morning"],
      partOfDay: "afternoon",
      maxOffer: 3,
    });
    expect(ranked.every((slot) => new Date(slot).getHours() >= 12)).toBe(true);
  });

  test("around 4pm ranks closest afternoon slots not noon", () => {
    const allSlots = [
      centralDateAt(2026, 8, 26, 12, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 12, 45, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 15, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 16, 0, TZ).toISOString(),
    ];
    const ranked = rankSlotsForOffer(allSlots, {
      partOfDay: "afternoon",
      anchorMinutes: 16 * 60,
      narrowAroundAnchor: true,
      maxOffer: 3,
    });
    expect(slotStartMinutes(ranked[0]!)).toBe(16 * 60);
    expect(ranked.every((slot) => (slotStartMinutes(slot) ?? 0) >= 12 * 60)).toBe(true);
    expect(ranked.every((slot) => (slotStartMinutes(slot) ?? 0) <= 17 * 60)).toBe(true);
  });

  test("Friday change preserves evening preference", () => {
    const refinement = detectSchedulingRefinement(
      "Actually what about Friday instead",
      {
        status: "slots_offered",
        centralDate: "2026-08-26",
        partOfDay: "evening",
        anchorTimeMinutes: 19 * 60,
      },
      [],
      now,
    );
    expect(refinement?.reason).toBe("refine_change_day");
    expect(refinement?.input.partOfDay).toBe("evening");
  });
});

describe("slot selection shorthand and priority", () => {
  function afternoonFourSlots(): string[] {
    return [0, 15, 30].map((minute) =>
      centralDateAt(2026, 8, 26, 16, minute, TZ).toISOString(),
    );
  }

  function morningSlots(): string[] {
    return [0, 30, 90].map((minute) =>
      centralDateAt(2026, 8, 26, 9, minute, TZ).toISOString(),
    );
  }

  const selectionMessages = ["430", "Sure 430", "4 30", "4.30", "430pm", "I'll take 430", "that 4:30 slot"];

  for (const message of selectionMessages) {
    test(`${message} books offered 4:30 PM slot`, () => {
      const slots = afternoonFourSlots();
      expect(resolveOfferedSlotSelection(message, slots)).toBe(slots[2]);
      const plan = planSchedulingGate({
        inboundMessage: message,
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
      expect(plan.action.type).toBe("book_appointment");
      expect(plan.action.type === "book_appointment" && plan.action.start).toBe(slots[2]);
    });
  }

  test("afternoon offered slots + 430 infers PM", () => {
    const slots = afternoonFourSlots();
    expect(extractRequestedTimeMinutes("430", slots)).toBe(16 * 60 + 30);
  });

  test("morning offered slots + 930 infers AM", () => {
    const slots = morningSlots();
    expect(extractRequestedTimeMinutes("930", slots)).toBe(9 * 60 + 30);
  });

  test("ambiguous AM/PM with mixed offered slots asks for clarification", () => {
    const mixed = [
      centralDateAt(2026, 8, 26, 9, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 21, 30, TZ).toISOString(),
    ];
    const plan = planSchedulingGate({
      inboundMessage: "930",
      context: roiSession({ scheduling: { status: "slots_offered", offeredSlots: mixed } }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
    expect(resolveOfferedSlotSelection("930", mixed)).toBeNull();
  });

  test("slot selection outranks refinement parsing for bare 430", () => {
    const slots = afternoonFourSlots();
    expect(detectSchedulingRefinement("430", { status: "slots_offered", offeredSlots: slots, centralDate: "2026-08-26", partOfDay: "afternoon" }, slots, now)).toBeNull();
  });

  test("clear selection does not trigger another availability lookup", () => {
    const slots = afternoonFourSlots();
    const plan = planSchedulingGate({
      inboundMessage: "430",
      context: roiSession({
        scheduling: { status: "slots_offered", offeredSlots: slots, centralDate: "2026-08-26", partOfDay: "afternoon" },
      }),
      now,
    });
    expect(plan.action.type).toBe("book_appointment");
  });

  test("deterministic slot offer copy avoids Which works best", () => {
    const slots = afternoonFourSlots();
    const first = buildContextualSlotOfferMessage({ slots, situation: "first_offer", variationSeed: "a" });
    const second = buildContextualSlotOfferMessage({ slots, situation: "refinement", variationSeed: "b" });
    expect(first.toLowerCase()).not.toContain("which works best");
    expect(second.toLowerCase()).not.toContain("which works best");
    expect(first).not.toBe(second);
  });
  test("applyOfferedSlots stores last offered slot fingerprint", () => {
    const slots = afternoonFourSlots();
    const updated = applyOfferedSlots(roiSession(), slots);
    expect(updated.scheduling.lastOfferedSlotKey).toBe(
      offeredSlotConstraintKey(slots, updated.scheduling),
    );
  });
});

describe("live phone regression: afternoon 430 selection", () => {
  function simulateOffer(session: ReturnType<typeof roiSession>, slots: string[]) {
    return {
      ...session,
      scheduling: {
        status: "slots_offered" as const,
        offeredSlots: slots,
        centralDate: "2026-08-26",
        partOfDay: "afternoon" as const,
        lastOfferedSlotKey: slots.slice().sort().join("|"),
      },
    };
  }

  test("full conversation ending in Sure 430 books 4:30 PM", () => {
    const afternoonNearFour = [0, 15, 30].map((minute) =>
      centralDateAt(2026, 8, 26, 16, minute, TZ).toISOString(),
    );

    let session = roiSession();
    for (const message of [
      "Missed call most likely",
      "No, I need an afternoon time",
      "No more like 4pm",
    ]) {
      planSchedulingGate({ inboundMessage: message, context: session, now });
      session = simulateOffer(session, afternoonNearFour);
    }

    for (const message of ["Sure 430", "430", "4:30"]) {
      const plan = planSchedulingGate({
        inboundMessage: message,
        context: simulateOffer(session, afternoonNearFour),
        now,
      });
      expect(plan.action.type).toBe("book_appointment");
      expect(plan.action.type === "book_appointment" && plan.action.start).toBe(afternoonNearFour[2]);
    }
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

  test("soft_closed OK does not trigger scheduling", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Ok",
      context: roiSession({ disposition: "soft_closed" }),
      now,
    });
    expect(plan.action.type).toBe("none");
    expect(plan.schedulingIntent).toBe(false);
  });
});

describe("scheduling truth hardening", () => {
  test("day-only weekday asks preference instead of fetching availability", () => {
    const plan = planSchedulingGate({
      inboundMessage: "Can you do Monday",
      context: roiSession({
        knownFacts: { ...roiSession().knownFacts!, fit: "yes", urgency: "high" },
      }),
      now,
    });
    expect(plan.action.type).toBe("ask_preference");
  });

  test("No afternoon pls after morning offer selects afternoon rather than rejecting it", () => {
    const morningSlots = [
      centralDateAt(2026, 8, 24, 9, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 24, 10, 0, TZ).toISOString(),
    ];
    const patch = detectSchedulingConstraints("No afternoon pls", {
      status: "slots_offered",
      centralDate: "2026-08-24",
      partOfDay: "morning",
      offeredSlots: morningSlots,
    });
    expect(patch.partOfDay).toBe("afternoon");
    expect(patch.rejectedPartOfDay ?? []).not.toContain("afternoon");
  });

  test("normalizeSchedulingStateConstraints removes active part from rejected list", () => {
    const normalized = normalizeSchedulingStateConstraints({
      status: "idle",
      centralDate: "2026-08-25",
      partOfDay: "afternoon",
      rejectedPartOfDay: ["afternoon"],
    });
    expect(normalized.partOfDay).toBe("afternoon");
    expect(normalized.rejectedPartOfDay ?? []).not.toContain("afternoon");
  });

  test("date change clears stale rejected slots and offered slots", () => {
    const normalized = normalizeSchedulingStateConstraints(
      {
        status: "slots_offered",
        centralDate: "2026-08-25",
        partOfDay: "afternoon",
        rejectedPartOfDay: ["afternoon"],
        offeredSlots: [centralDateAt(2026, 8, 24, 9, 0, TZ).toISOString()],
      },
      { prior: { status: "slots_offered", centralDate: "2026-08-24", partOfDay: "afternoon" } },
    );
    expect(normalized.centralDate).toBe("2026-08-25");
    expect(normalized.rejectedPartOfDay ?? []).not.toContain("afternoon");
    expect(normalized.offeredSlots).toBeUndefined();
  });

  test("messageHasResolvedDayWithoutPartOfDay detects weekday-only requests", () => {
    expect(messageHasResolvedDayWithoutPartOfDay("How about next Tuesday", undefined, null, now)).toBe(
      true,
    );
    expect(messageHasResolvedDayWithoutPartOfDay("Tuesday afternoon", undefined, null, now)).toBe(
      false,
    );
  });

  test("detectDaypartSelectionCorrection handles I meant afternoon", () => {
    expect(
      detectDaypartSelectionCorrection("I meant afternoon", {
        status: "slots_offered",
        centralDate: "2026-08-24",
        partOfDay: "morning",
      }),
    ).toBe("afternoon");
  });
});
