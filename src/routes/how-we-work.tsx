import { createFileRoute } from "@tanstack/react-router";
import { ProcessStepCard } from "~/components/marketing/MarketingCards";
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
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-brand-mint">
            The process, start to finish
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Start With the{" "}
            <span className="text-brand-mint">Business Problem</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            The first step is understanding what you want to improve and how the
            work happens today. Some problems call for one focused implementation.
            Others cross several systems and deserve a deeper Diagnostic before
            anything is built.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <ol className="relative grid list-none gap-8 p-0 lg:gap-10">
            {HOW_WE_WORK_STEPS.map((step, index) => (
              <li key={step.step} className="relative">
                {index < HOW_WE_WORK_STEPS.length - 1 ? (
                  <span
                    className="absolute left-6 top-16 hidden h-[calc(100%+2rem)] w-px bg-brand-accent lg:block"
                    aria-hidden="true"
                  />
                ) : null}
                <ProcessStepCard
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
              href="/contact"
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
