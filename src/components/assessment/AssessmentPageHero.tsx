import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";

/** Persistent assessment hero — must remain visible on every flow step. */
export function AssessmentPageHero() {
  return (
    <MarketingNavyHero
      testId="assessment-hero"
      headingId="assessment-hero-heading"
      eyebrow="Revenue Leak Report"
      meta="About 3-5 minutes."
      supporting="See where missed calls, slow follow-up and operational gaps may be costing you revenue, then discover where to start fixing them."
    >
      <span className="text-white">Find the Revenue Leaks </span>
      <span className="text-brand-primary">Costing You Jobs</span>
    </MarketingNavyHero>
  );
}
