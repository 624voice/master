/** 90-Day Results Guarantee — eligible offer contexts only (approved scope). */
export type GuaranteeOfferContext =
  | "624-convert"
  | "624-revenue"
  | "624-orchestrate"
  | "get-found"
  | "website-only"
  | "standalone-website-design"
  | "standalone-website-optimization";

const ELIGIBLE = new Set<GuaranteeOfferContext>([
  "624-convert",
  "624-revenue",
  "624-orchestrate",
]);

export function is90DayResultsGuaranteeEligible(
  context: GuaranteeOfferContext,
): boolean {
  return ELIGIBLE.has(context);
}

export const GUARANTEE_ELIGIBILITY_FOOTNOTE =
  "90-Day Results Guarantee for eligible Convert, Revenue, and Orchestrate engagements.";
