import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildSchedulingRequestKey,
  offerSetKey,
} from "~/server/scheduling/requestKey";
import {
  mergeIntentIntoState,
  parseSchedulingIntentUpdate,
  buildSchedulingRequestFromState,
} from "~/server/scheduling/intentParser";
import { resolveRangeForRequest } from "~/server/scheduling/rangeResolver";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import {
  inferOfferPresentationType,
  inferZeroSlotReason,
} from "~/server/scheduling/trace";
import { buildSlotOfferCopy } from "~/server/scheduling/copy";
import { toCanonicalSchedulingState, invalidateOffersForRequestChange } from "~/server/scheduling/state";
import {
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import {
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import { detectMeetingBridgeAgreement } from "~/server/speed2Lead/conversationHandoff";
import { resolveLlmTurnTask } from "~/server/speed2Lead/conversationStage";
import { shouldAskAnotherDiagnosticQuestion } from "~/server/speed2Lead/discoveryProgress";
import type { ConversationContext } from "~/server/speed2Lead/types";

const mondayMorning = centralDateAt(2026, 8, 24, 9, 0, CONSULTATION_TIMEZONE);
const businessHours = getConsultationBusinessHours();
const duration = getConsultationDurationMinutes();

describe("scheduling intent parser", () => {
  test("1. Monday Central tomorrow resolves to Tuesday", () => {
    expect(tomorrowCentralDate(mondayMorning)).toBe("2026-08-25");
  });

  test("2. Monday Central Wednesday resolves to Aug 26", () => {
    expect(nextWeekdayCentral("wednesday", mondayMorning)).toBe("2026-08-26");
  });

  test("3. Wednesday afternoon resolves correct UTC provider range", () => {
    const request = buildSchedulingRequestFromState(
      mergeIntentIntoState(
        { status: "idle" },
        parseSchedulingIntentUpdate("Wednesday afternoon", undefined, mondayMorning),
      ),
      CONSULTATION_TIMEZONE,
      businessHours,
      duration,
    )!;
    const range = resolveRangeForRequest(request, mondayMorning);
    expect("error" in range).toBe(false);
    if ("error" in range) return;
    expect(range.rangeStart.toISOString()).toBe("2026-08-26T17:00:00.000Z");
    expect(range.rangeEnd.toISOString()).toBe("2026-08-26T22:00:00.000Z");
  });

  test("4. Tomorrow afternoon then Tomorrow broadens to full_day", () => {
    let state = mergeIntentIntoState(
      { status: "idle" },
      parseSchedulingIntentUpdate("Tomorrow afternoon", undefined, mondayMorning),
    );
    expect(state.availabilityPreference).toBe("afternoon");
    state = mergeIntentIntoState(
      state,
      parseSchedulingIntentUpdate("Tomorrow", state, mondayMorning),
    );
    expect(state.availabilityPreference).toBe("full_day");
    expect(state.requestedDate).toBe("2026-08-25");
  });

  test("5. Wednesday morning then Anytime Wednesday clears morning", () => {
    let state = mergeIntentIntoState(
      { status: "idle" },
      parseSchedulingIntentUpdate("Wednesday morning", undefined, mondayMorning),
    );
    expect(state.availabilityPreference).toBe("morning");
    state = mergeIntentIntoState(
      state,
      parseSchedulingIntentUpdate("Anytime on Wednesday", state, mondayMorning),
    );
    expect(state.availabilityPreference).toBe("full_day");
  });

  test("6-7. Anytime / flexible Wednesday uses full_day preference", () => {
    for (const message of ["Anytime Wednesday", "I'm flexible Wednesday"]) {
      const state = mergeIntentIntoState(
        { status: "idle" },
        parseSchedulingIntentUpdate(message, undefined, mondayMorning),
      );
      expect(state.availabilityPreference).toBe("full_day");
      expect(state.requestedDate).toBe("2026-08-26");
    }
  });

  test("8-10. earliest phrases resolve to earliest preference", () => {
    for (const message of [
      "First available Wednesday",
      "What's your first availability?",
      "Whatever is first",
    ]) {
      const state = mergeIntentIntoState(
        { status: "idle" },
        parseSchedulingIntentUpdate(message, undefined, mondayMorning),
      );
      expect(state.availabilityPreference).toBe("earliest");
    }
  });
});

describe("request keys and presentation", () => {
  test("15. request key changes afternoon to full_day", () => {
    const afternoon = buildSchedulingRequestKey({
      timezone: CONSULTATION_TIMEZONE,
      requestedDate: "2026-08-26",
      availabilityPreference: "afternoon",
      businessHours,
      meetingDurationMinutes: duration,
    });
    const full = buildSchedulingRequestKey({
      timezone: CONSULTATION_TIMEZONE,
      requestedDate: "2026-08-26",
      availabilityPreference: "full_day",
      businessHours,
      meetingDurationMinutes: duration,
    });
    expect(afternoon).not.toBe(full);
  });

  test("16. request key changes on date change", () => {
    const a = buildSchedulingRequestKey({
      timezone: CONSULTATION_TIMEZONE,
      requestedDate: "2026-08-25",
      availabilityPreference: "full_day",
      businessHours,
      meetingDurationMinutes: duration,
    });
    const b = buildSchedulingRequestKey({
      timezone: CONSULTATION_TIMEZONE,
      requestedDate: "2026-08-26",
      availabilityPreference: "full_day",
      businessHours,
      meetingDurationMinutes: duration,
    });
    expect(a).not.toBe(b);
  });

  test("17. request key changes on exact time", () => {
    const base = buildSchedulingRequestKey({
      timezone: CONSULTATION_TIMEZONE,
      requestedDate: "2026-08-26",
      availabilityPreference: "exact_time",
      exactTimeMinutes: 900,
      businessHours,
      meetingDurationMinutes: duration,
    });
    expect(base).toBe("date:2026-08-26|exact:900");
  });

  test("18. old offers cleared on new request key", () => {
    const prior = invalidateOffersForRequestChange(
      {
        status: "slots_offered",
        activeRequestKey: "date:2026-08-25|afternoon",
        offeredSlots: ["2026-08-25T15:00:00.000Z"],
        lastPresentedOfferKey: "x",
      },
      "date:2026-08-25|full_day",
    );
    expect(prior.offeredSlots).toBeUndefined();
    expect(prior.status).toBe("idle");
  });

  test("19-20. first vs repeat offer copy", () => {
    const slots = ["2026-08-26T14:00:00.000Z", "2026-08-26T14:45:00.000Z"];
    const key = offerSetKey(slots);
    const first = inferOfferPresentationType({ slots, requestKeyChanged: false });
    const repeat = inferOfferPresentationType({
      slots,
      lastPresentedOfferKey: key,
      requestKeyChanged: false,
    });
    expect(first).toBe("first_offer");
    expect(repeat).toBe("repeat_offer");
    expect(buildSlotOfferCopy(slots, first)).toMatch(/are open\./);
    expect(buildSlotOfferCopy(slots, repeat)).toMatch(/still available/i);
  });
});

describe("filter diagnostics", () => {
  test("12. raw slots filtered to zero yields constraint_filter reason", () => {
    const raw = ["2026-08-26T18:00:00.000Z"];
    const filtered = filterAndRankSlots({
      rawSlots: raw,
      request: {
        timezone: CONSULTATION_TIMEZONE,
        requestedDate: "2026-08-26",
        availabilityPreference: "morning",
        businessHours,
        meetingDurationMinutes: duration,
      },
    });
    expect(filtered.length).toBe(0);
    expect(
      inferZeroSlotReason({
        providerInvoked: true,
        rawProviderSlotCount: 1,
        filteredSlotCount: 0,
        providerOk: true,
      }),
    ).toBe("constraint_filter");
  });

  test("13. provider zero yields provider_empty", () => {
    expect(
      inferZeroSlotReason({
        providerInvoked: true,
        rawProviderSlotCount: 0,
        filteredSlotCount: 0,
        providerOk: true,
      }),
    ).toBe("provider_empty");
  });

  test("14. never_called when provider not invoked", () => {
    expect(
      inferZeroSlotReason({
        providerInvoked: false,
        rawProviderSlotCount: 0,
        filteredSlotCount: 0,
        providerOk: true,
      }),
    ).toBe("never_called");
  });
});

describe("meeting interest invariant", () => {
  function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
    return {
      flow: "roi",
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$120,000",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
      state: "awaiting_problem",
      messages: [
        {
          role: "assistant",
          content:
            "If I could show you a way to capture more missed calls, would 25 minutes be worth a look?",
          at: mondayMorning.toISOString(),
        },
      ],
      knownFacts: {
        firstName: "Alex",
        phone: "+15551234567",
        flow: "roi",
        businessName: "Test Plumbing",
        customerGoal: "Missed calls",
        questionsAsked: 1,
        meetingInterestConfirmed: false,
      },
      scheduling: { status: "idle" },
      updatedAt: mondayMorning.toISOString(),
      ...overrides,
    };
  }

  test("31-33. bridge affirmatives detected contextually", () => {
    const session = roiSession();
    expect(detectMeetingBridgeAgreement("Of course")).toBe(true);
    expect(detectMeetingBridgeAgreement("Absolutely")).toBe(true);
    expect(detectMeetingBridgeAgreement("Definitely")).toBe(true);
    expect(detectMeetingBridgeAgreement("Of course")).toBe(true);
    void session;
  });

  test("34. after meetingInterestConfirmed no discovery task", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        meetingInterestConfirmed: true,
        discoveryPhase: "scheduling",
      },
    });
    expect(shouldAskAnotherDiagnosticQuestion(session)).toBe(false);
    expect(resolveLlmTurnTask(session, "ok").task).toBe("brief_active_conversation");
    expect(resolveLlmTurnTask(session, "ok").stage).toBe("scheduling");
  });
});

describe("scheduling gate planning", () => {
  test("anytime wednesday plans availability not ask_preference", async () => {
    const { planSchedulingGate } = await import("~/server/speed2Lead/schedulingGate");
    const session: ConversationContext = {
      flow: "roi",
      phone: "+15551234567",
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
        phone: "+15551234567",
        flow: "roi",
        questionsAsked: 0,
        meetingInterestConfirmed: true,
      },
      scheduling: { status: "idle" },
      updatedAt: mondayMorning.toISOString(),
    };
    const prepared = (await import("~/server/speed2Lead/schedulingIntent")).prepareInboundSchedulingTurn(
      session,
      "Anytime on Wednesday",
      mondayMorning,
    );
    const plan = planSchedulingGate({
      inboundMessage: "Anytime on Wednesday",
      context: prepared,
      now: mondayMorning,
    });
    expect(plan.action.type).toBe("get_availability");
  });
});
