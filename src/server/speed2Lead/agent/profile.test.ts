import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE, painOutcomeFor } from "~/server/speed2Lead/agent/profile";

describe("painOutcomeFor", () => {
  test("returns the matching pain outcome by key", () => {
    const outcome = painOutcomeFor(DEFAULT_624VOICE_PROFILE, "missed_calls");
    expect(outcome.label).toBe("missed calls");
    expect(outcome.outcomes.length).toBeGreaterThan(0);
  });

  test("falls back to a general outcome for an unknown or missing key", () => {
    expect(painOutcomeFor(DEFAULT_624VOICE_PROFILE, undefined).key).toBe("general");
    expect(painOutcomeFor(DEFAULT_624VOICE_PROFILE, "not_a_real_pain").key).toBe("general");
  });
});

describe("DEFAULT_624VOICE_PROFILE.resultsGuarantee", () => {
  test("uses the 90-day results-guarantee wording", () => {
    expect(DEFAULT_624VOICE_PROFILE.resultsGuarantee).toBe(
      "we back it with a 90-day results guarantee: you either see it pay for itself in booked revenue within 90 days, or we keep working for free until it does.",
    );
  });
});
