import { createFileRoute } from "@tanstack/react-router";
import { HowWeWorkStepCard } from "~/components/marketing/MarketingCards";
import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";
import { HOW_WE_WORK_STEPS } from "~/content/clientEngagementProcess";
import { PUBLIC_CTA } from "~/content/publicConversion";

export const Route = createFileRoute("/how-we-work")({
  head: () => ({
    meta: [
      {
        title: "How We Work | 624 Voice",
      },
      {
        name: "description",
        content:
          "From understanding your opportunity to measured rollout, see how 624 Voice helps home-service companies improve leads, follow-up, and customer operations step by step.",
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
        decorIcons
        supporting="The first step is understanding what you want to improve and how the work happens today. Some problems call for one focused implementation; others need a clearer sequence before anything is built."
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
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg leading-relaxed text-gray-300">
            Ready to talk through where your operation needs attention first?
          </p>
          <a
            href={PUBLIC_CTA.exploreOptionsHref}
            className="mt-8 inline-flex rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
          >
            {PUBLIC_CTA.exploreOptions}
          </a>
        </div>
      </section>
    </main>
  );
}
