import { createFileRoute } from "@tanstack/react-router";
import { FEATURE_FLAGS } from "~/config/features";

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
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Why 624 Voice
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Practical AI for the Work That{" "}
            <span className="text-brand-primary">Keeps a Business Moving</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            624 Voice helps growing home-service companies improve how they
            attract, respond to, convert, and retain customers. The work
            combines business diagnosis, customer-experience design,
            implementation, integration, and ongoing measurement.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
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
      </section>

      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Why we look before we recommend
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            We begin by understanding how the business works today, where the
            customer journey slows down, which tools are already useful, and what
            outcome matters. That context gives each recommendation a practical
            reason to exist.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Founder
          </h2>
          {FEATURE_FLAGS.SHOW_FOUNDER_PARAGRAPH_UPDATE ? (
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              624 Voice was founded by Chris, who brings more than 18 years of
              work across business communications, enterprise technology,
              customer experience, contact centers, and modernization. His
              current work focuses on enterprise AI agents and customer
              operations. That experience spans multiple organizations and
              roles over two decades; what&apos;s described here is the
              throughline, not the complete list.
            </p>
          ) : (
            <p className="mt-6 text-lg leading-relaxed text-gray-700">
              624 Voice was founded by Chris.
            </p>
          )}
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Faith shapes how we work through stewardship, integrity, service, and
            keeping commitments. It also means being honest when the right
            recommendation is no change at all.
          </p>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Why quarterly reviews matter to us
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Quarterly business reviews compare the work with the measures agreed
            at the start. They show what is working, what needs attention, and
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
