import { describe, expect, test } from "bun:test";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import {
  CONSULTATION_TIMEZONE,
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import {
  applyInboundSchedulingUpdate,
  parseSchedulingStateUpdate,
} from "~/server/scheduling/intentParser";
import { buildSchedulingRequestKey } from "~/server/scheduling/requestKey";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import { buildRequestFromCanonicalState } from "~/server/scheduling/state";
import type { LegacyConstraintFields } from "~/server/scheduling/state";
import type { CanonicalSchedulingState } from "~/server/scheduling/types";
import {
  applySchedulingStateUpdate,
  normalizeImpossibleBounds,
  validateSchedulingConstraints,
} from "~/server/scheduling/stateUpdate";
import { resolveRangeForRequest } from "~/server/scheduling/rangeResolver";

const TZ = CONSULTATION_TIMEZONE;
const thursdayEvening = centralDateAt(2026, 8, 27, 18, 0, TZ);
const businessHours = getConsultationBusinessHours();
const duration = getConsultationDurationMinutes();

type State = CanonicalSchedulingState & LegacyConstraintFields;

function baseThursdayEvening(): State {
  return {
    status: "slots_offered",
    requestedDate: "2026-08-27",
    availabilityPreference: "evening",
    partOfDay: "evening",
    searchAfterMinutes: 16 * 60,
    earliestAllowedMinutes: 16 * 60,
    anchorTimeMinutes: 17 * 60,
    exactTimeMinutes: 10 * 60,
    offeredSlots: ["2026-08-27T21:00:00.000Z"],
  };
}

function applyTurn(state: State, message: string): State {
  return applyInboundSchedulingUpdate(state, message, thursdayEvening, state.offeredSlots ?? []);
}

describe("scheduling state transition matrix", () => {
  test("Thursday evening → What about 5? → exact 5pm, no stale evening bound", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "What about 5?");
    expect(state.exactTimeMinutes).toBe(17 * 60);
    expect(state.availabilityPreference).toBe("exact_time");
    expect(state.anchorTimeMinutes).toBeUndefined();
    expect(state.searchAfterMinutes).toBeUndefined();
    expect(state.earliestAllowedMinutes).toBeUndefined();
  });

  test("4? replaces 5pm exact time", () => {
    let state = applyTurn(baseThursdayEvening(), "What about 5?");
    state = applyTurn(state, "4?");
    expect(state.exactTimeMinutes).toBe(16 * 60);
    expect(state.anchorTimeMinutes).toBeUndefined();
  });

  test("No 4pm clears exact and rejects — never selects 4pm", () => {
    let state = applyTurn(baseThursdayEvening(), "What about 5?");
    state = applyTurn(state, "4?");
    state = applyTurn(state, "No 4pm");
    expect(state.exactTimeMinutes).toBeUndefined();
    expect(state.availabilityPreference).not.toBe("exact_time");
    const patch = parseSchedulingStateUpdate("No 4pm", state, thursdayEvening);
    expect(patch.exactTimeMinutes?.op).not.toBe("replace");
  });

  test("Then Friday clears stale Thursday constraints", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "Then Friday");
    expect(state.requestedDate).toBe("2026-08-28");
    expect(state.exactTimeMinutes).toBeUndefined();
    expect(state.anchorTimeMinutes).toBeUndefined();
    expect(state.searchAfterMinutes).toBeUndefined();
    expect(state.searchBeforeMinutes).toBeUndefined();
  });

  test("Need a morning time on Friday clears exact/anchor/bounds", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "Then Friday");
    state = applyTurn(state, "Need a morning time on Friday");
    expect(state.availabilityPreference).toBe("morning");
    expect(state.exactTimeMinutes).toBeUndefined();
    expect(state.anchorTimeMinutes).toBeUndefined();
    expect(state.searchAfterMinutes).toBeUndefined();
    expect(state.searchBeforeMinutes).toBeUndefined();
  });

  test("10am? sets exact 10am on Friday", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "Then Friday");
    state = applyTurn(state, "Need a morning time on Friday");
    state = applyTurn(state, "10am?");
    expect(state.exactTimeMinutes).toBe(10 * 60);
    expect(state.availabilityPreference).toBe("exact_time");
  });

  test("What morning times broadens and clears exact", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "Then Friday");
    state = applyTurn(state, "10am?");
    state = applyTurn(state, "What morning times do you have?");
    expect(state.availabilityPreference).toBe("morning");
    expect(state.exactTimeMinutes).toBeUndefined();
    expect(state.anchorTimeMinutes).toBeUndefined();
  });

  test("Friday? during active Thursday replaces date", () => {
    const state = applyTurn(
      { status: "idle", requestedDate: "2026-08-27", availabilityPreference: "evening" },
      "Friday?",
    );
    expect(state.requestedDate).toBe("2026-08-28");
  });
});

describe("provider-truth invariants", () => {
  const fridayMorningSlots = [
    "2026-08-28T14:00:00.000Z",
    "2026-08-28T14:30:00.000Z",
    "2026-08-28T15:00:00.000Z",
  ];

  test("Friday morning returns slots after Thursday evening pivot", () => {
    let state = baseThursdayEvening();
    state = applyTurn(state, "Then Friday");
    state = applyTurn(state, "Need a morning time on Friday");
    const request = buildRequestFromCanonicalState(state, TZ, businessHours, duration)!;
    const filtered = filterAndRankSlots({ rawSlots: fridayMorningSlots, request });
    expect(filtered.length).toBeGreaterThan(0);
  });

  test("Friday 10am available when provider has slot", () => {
    const state: State = {
      status: "idle",
      requestedDate: "2026-08-28",
      availabilityPreference: "exact_time",
      exactTimeMinutes: 10 * 60,
    };
    const request = buildRequestFromCanonicalState(state, TZ, businessHours, duration)!;
    const filtered = filterAndRankSlots({
      rawSlots: ["2026-08-28T15:00:00.000Z"],
      request,
    });
    expect(filtered).toEqual(["2026-08-28T15:00:00.000Z"]);
  });

  test("stale anchor cannot affect new daypart query", () => {
    const state = normalizeImpossibleBounds(
      applyTurn(baseThursdayEvening(), "Need a morning time on Friday"),
    );
    expect(state.anchorTimeMinutes).toBeUndefined();
    const request = buildRequestFromCanonicalState(state, TZ, businessHours, duration)!;
    expect(request.anchorTime).toBeUndefined();
    const range = resolveRangeForRequest(request, thursdayEvening);
    expect("error" in range).toBe(false);
  });

  test("impossible lower>upper normalized before query", () => {
    const corrupted: State = {
      status: "idle",
      requestedDate: "2026-08-28",
      availabilityPreference: "morning",
      searchAfterMinutes: 16 * 60,
      searchBeforeMinutes: 12 * 60,
    };
    expect(validateSchedulingConstraints(corrupted).ok).toBe(false);
    const normalized = normalizeImpossibleBounds(corrupted);
    expect(validateSchedulingConstraints(normalized).ok).toBe(true);
    const request = buildRequestFromCanonicalState(normalized, TZ, businessHours, duration)!;
    const filtered = filterAndRankSlots({ rawSlots: fridayMorningSlots, request });
    expect(filtered.length).toBeGreaterThan(0);
  });

  test("request key changes when semantic truth changes", () => {
    const morningKey = buildSchedulingRequestKey({
      timezone: TZ,
      requestedDate: "2026-08-28",
      availabilityPreference: "morning",
      businessHours,
      meetingDurationMinutes: duration,
    });
    const exactKey = buildSchedulingRequestKey({
      timezone: TZ,
      requestedDate: "2026-08-28",
      availabilityPreference: "exact_time",
      exactTimeMinutes: 10 * 60,
      businessHours,
      meetingDurationMinutes: duration,
    });
    expect(morningKey).not.toBe(exactKey);
  });

  test("No 4pm does not produce exact_time request key", () => {
    let state = applyTurn(baseThursdayEvening(), "4?");
    state = applyTurn(state, "No 4pm");
    const request = buildRequestFromCanonicalState(state, TZ, businessHours, duration);
    if (request?.availabilityPreference === "exact_time") {
      expect(request.exactTimeMinutes).not.toBe(16 * 60);
    } else {
      expect(request?.exactTimeMinutes).toBeUndefined();
    }
  });
});

describe("PRESERVE / REPLACE / CLEAR apply semantics", () => {
  test("REPLACE exact clears prior value", () => {
    const prior: State = {
      status: "idle",
      requestedDate: "2026-08-27",
      availabilityPreference: "exact_time",
      exactTimeMinutes: 17 * 60,
    };
    const next = applySchedulingStateUpdate(prior, {
      exactTimeMinutes: { op: "replace", value: 16 * 60 },
      availabilityPreference: { op: "replace", value: "exact_time" },
    });
    expect(next.exactTimeMinutes).toBe(16 * 60);
  });

  test("CLEAR removes stale bound", () => {
    const prior: State = {
      status: "idle",
      requestedDate: "2026-08-27",
      availabilityPreference: "morning",
      searchAfterMinutes: 16 * 60,
      earliestAllowedMinutes: 16 * 60,
    };
    const next = applySchedulingStateUpdate(prior, {
      lowerTimeBound: { op: "clear" },
      upperTimeBound: { op: "clear" },
    });
    expect(next.searchAfterMinutes).toBeUndefined();
    expect(next.earliestAllowedMinutes).toBeUndefined();
    expect(next.searchBeforeMinutes).toBeUndefined();
    expect(next.latestAllowedMinutes).toBeUndefined();
  });
});
