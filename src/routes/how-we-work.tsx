import { createFileRoute } from "@tanstack/react-router";
import { HowWeWorkStepCard } from "~/components/marketing/MarketingCards";
import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";
import { HOW_WE_WORK_STEPS } from "~/content/clientEngagementProcess";

export const Route = createFileRoute("/how-we-work")({
  head: () => ({
    meta: [
      {
        title: "How 624 Voice Works | AI Growth Systems for Home Services",
      },
      {
        name: "description",
        content:
          "From a free consultation to a measured, modular rollout, see exactly how 624 Voice helps home-service companies find and fix growth gaps, step by step.",
      },
    ],
  }),
  component: HowWeWorkPage,
});

const STEP_ICONS = ["compass", "chart", "gears", "phone"] as const;

function HowWeWorkPage() {
  return (
    <main className="pt-20">
      <MarketingNavyHero
        testId="how-we-work-hero"
        headingId="how-we-work-hero-heading"
        eyebrow="How we work"
        supporting="The first step is understanding what you want to improve and how the work happens today. Some problems call for one focused implementation; others deserve a deeper Diagnostic first."
      >
        <span className="text-white">Start With the </span>
        <span className="text-brand-primary">Business Problem</span>
      </MarketingNavyHero>

      <section className="overflow-x-hidden bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <ol className="grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8">
            {HOW_WE_WORK_STEPS.map((step, index) => (
              <li key={step.step} className="relative flex">
                <HowWeWorkStepCard
                  step={step.step}
                  title={step.title}
                  body={step.body}
                  deliverable={step.deliverable}
                  icon={
                    <JourneyStageIcon
                      iconId={STEP_ICONS[index] ?? "chart"}
                      className="h-6 w-6"
                    />
                  }
                />
                {"trustHighlight" in step && step.trustHighlight ? (
                  <p className="mt-4 rounded-lg border border-brand-primary/20 bg-brand-primary-light/50 px-4 py-3 text-sm font-medium text-brand-secondary">
                    {step.trustHighlight}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-gray-400">
            The consultation determines whether a focused project, a deeper
            Diagnostic, or no immediate change is the most useful next step.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/book"
              className="inline-flex rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
            >
              Book Your AI Growth Systems Consultation
            </a>
            <a
              href="/assessment"
              className="inline-flex rounded-lg border border-gray-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-gray-400 hover:bg-white/5"
            >
              Get Your Free Assessment
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
