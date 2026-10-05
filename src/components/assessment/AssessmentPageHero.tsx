import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";

/** Persistent assessment hero — must remain visible on every flow step. */
export function AssessmentPageHero() {
  return (
    <MarketingNavyHero
      testId="assessment-hero"
      headingId="assessment-hero-heading"
      eyebrow="Free business assessment"
      meta="About 3-5 minutes."
      supporting="Six areas where home-service businesses leak revenue and time, ranked for your trade and fleet size."
    >
      <span className="text-white">Find Your </span>
      <span className="text-brand-primary">Top Priorities</span>
    </MarketingNavyHero>
  );
}
