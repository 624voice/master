import { createFileRoute } from "@tanstack/react-router";
import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";
import { WaveformDetail } from "~/components/marketing/MarketingCards";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      {
        title: "About 624 Voice | AI Growth Systems for Home Services",
      },
      {
        name: "description",
        content:
          "Learn how 624 Voice brings practical AI, disciplined implementation, and honest recommendations to growing home-service companies.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="pt-20">
      <MarketingNavyHero
        testId="about-hero"
        headingId="about-hero-heading"
        eyebrow="Why 624 Voice"
        supporting="624 Voice helps growing home-service companies improve how they attract, respond to, convert, and retain customers through diagnosis, design, implementation, and measurement."
      >
        <span className="text-white">Practical AI for the Work That </span>
        <span className="text-brand-primary">Keeps a Business Moving</span>
      </MarketingNavyHero>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-2xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary-light/40 to-white p-8 shadow-md">
            <WaveformDetail className="absolute right-6 top-6 opacity-40" />
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-primary-dark">
              Matthew 6:24
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-brand-secondary">
              Why the name 624
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              624 references Matthew 6:24: you can&apos;t serve two masters. For
              us, that&apos;s a simple operating rule: technology should serve the
              people using it, not the other way around. We&apos;d rather tell a
              business no immediate change is needed than sell something that
              doesn&apos;t actually help.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            A Founder-Led Practice
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            624 Voice is a founder-led practice built to give growing home-service
            companies direct, accountable guidance from diagnosis through
            implementation and ongoing improvement.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            The work is informed by more than 18 years across business
            communications, enterprise technology, customer experience, contact
            centers, and modernization. That experience now includes enterprise AI
            agents and customer operations.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Faith shapes how we work through stewardship, integrity, service, and
            keeping commitments. It also means being honest when the right
            recommendation is no change at all.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Why quarterly reviews matter to us
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Quarterly business reviews compare the work with the measures agreed at
            the start. They show what is working, what needs attention, and
            whether the next investment is justified.
          </p>
        </div>
      </section>

      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-gray-400">
            Bring the problem you want to solve. Leave with a clearer next step.
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
