import { createFileRoute } from "@tanstack/react-router";
import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";
import { PUBLIC_CTA } from "~/content/publicConversion";

const APPROVED_MISSION_COPY =
  "624 helps home-service companies recover lost revenue and grow without adding office headcount by automating repetitive customer-facing work and moving every opportunity to the next right step, from first contact through repeat business, across the systems they already use.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      {
        title: "About 624 Voice | AI Growth Systems for Home Services",
      },
      {
        name: "description",
        content:
          "Learn why 624 Voice exists, what Matthew 6:24 means for how we work, and how we help home-service companies reclaim time and revenue.",
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
        eyebrow="Our Story"
        decorIcons
        supporting="Faith, family, and a business that serves you—not the other way around."
      >
        <span className="text-white">Built to Help You Serve </span>
        <span className="text-brand-primary">What Matters Most</span>
      </MarketingNavyHero>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-gray-100 bg-brand-accent-light p-12">
            <p className="text-2xl font-medium italic leading-relaxed text-brand-secondary sm:text-3xl">
              &ldquo;No one can serve two masters. Either you will hate the one and
              love the other, or you will be devoted to the one and despise the
              other. You cannot serve both God and money.&rdquo;
            </p>
            <p className="mt-6 text-base text-gray-500">— Matthew 6:24 (NIV)</p>
          </div>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Why &ldquo;624&rdquo;?
          </h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              The number in our name comes from Matthew 6:24 — a verse that
              uses startling language on purpose. The original Greek word for
              &ldquo;serve&rdquo; in this passage is <em>douleuō</em>, which literally means
              &ldquo;to be a slave to.&rdquo;
            </p>
            <p>
              Jesus isn&apos;t being polite here. He&apos;s saying: you will be a slave to
              something. The question is not{" "}
              <em>if you will serve a master</em> — it&apos;s{" "}
              <em>which master you will serve</em>.
            </p>
            <p>
              We started 624 Voice because we saw too many home services
              owners — good people, skilled tradesmen, family men and women —
              who had become slaves to their own businesses. The business they
              built to provide for their family was consuming their family. They
              were missing dinner, missing games, missing vacations, missing
              life.
            </p>
            <p>
              We believe your business should serve you — not the other way
              around. When your business runs on its own, you&apos;re free to serve
              what matters most: your family, your faith, and your purpose.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Our Mission
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            {APPROVED_MISSION_COPY}
          </p>
        </div>
      </section>

      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <a
            href={PUBLIC_CTA.exploreOptionsHref}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
          >
            {PUBLIC_CTA.exploreOptions}
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>
      </section>
    </main>
  );
}
