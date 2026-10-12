import { describe, expect, test } from "bun:test";
import { is90DayResultsGuaranteeEligible } from "~/lib/marketing/guaranteeEligibility";

describe("90-day guarantee eligibility", () => {
  test("eligible for Convert, Revenue, and Orchestrate", () => {
    expect(is90DayResultsGuaranteeEligible("624-convert")).toBe(true);
    expect(is90DayResultsGuaranteeEligible("624-revenue")).toBe(true);
    expect(is90DayResultsGuaranteeEligible("624-orchestrate")).toBe(true);
  });

  test("not eligible for Get Found or website-only contexts", () => {
    expect(is90DayResultsGuaranteeEligible("get-found")).toBe(false);
    expect(is90DayResultsGuaranteeEligible("website-only")).toBe(false);
    expect(is90DayResultsGuaranteeEligible("standalone-website-design")).toBe(false);
    expect(is90DayResultsGuaranteeEligible("standalone-website-optimization")).toBe(
      false,
    );
  });
});
