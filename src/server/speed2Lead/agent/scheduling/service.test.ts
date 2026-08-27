import { describe, expect, test, mock, beforeEach } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildSchedulingRequestKey,
  offerSetKey,
} from "~/server/speed2Lead/agent/scheduling/requestKey";
import {
  mergeIntentIntoState,
  parseSchedulingIntentUpdate,
  buildSchedulingRequestFromState,
} from "~/server/speed2Lead/agent/scheduling/intentParser";
import { resolveRangeForRequest } from "~/server/speed2Lead/agent/scheduling/rangeResolver";
import { filterAndRankSlots } from "~/server/speed2Lead/agent/scheduling/filterRank";
import {
  inferOfferPresentationType,
  inferZeroSlotReason,
} from "~/server/speed2Lead/agent/scheduling/trace";
import { buildSlotOfferCopy } from "~/server/speed2Lead/agent/scheduling/copy";
import { toCanonicalSchedulingState, invalidateOffersForRequestChange } from "~/server/speed2Lead/agent/scheduling/state";
import {
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/agent/scheduling/schedulingRange";
import {
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";

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
