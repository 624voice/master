import { createFileRoute } from "@tanstack/react-router";

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

const steps = [
  {
    number: 1,
    title: "AI Growth Systems Consultation",
    body: "A free, focused conversation, about 30 minutes. We talk through your priorities and constraints, how leads move through your business today, where the friction is most visible, what tools you already have, and the business outcome that actually matters to you. You leave knowing whether the next step is a focused project, a paid Diagnostic, or genuinely no change right now.",
    covered: [
      "Your priorities and constraints",
      "Your current lead and customer journey",
      "The most visible operational friction",
      "The tools and systems already in place",
      "The business outcome that matters most",
      "The recommended next step",
    ],
  },
  {
    number: 2,
    title: "Paid Diagnostic, When a Deeper Look Is Warranted",
    body: "If the Consultation surfaces one contained problem, we scope it directly. If it surfaces something bigger (several connected issues, or genuine uncertainty about where the real constraint is), a paid AI Revenue and Operations Diagnostic takes a full look at your customer journey, workflows, data, and systems before anything gets built. You keep the roadmap either way.",
  },
  {
    number: 3,
    title: "Roadmap and Focused Scope",
    body: "Whether it comes from a focused scoping conversation or the full Diagnostic, you get a prioritized plan: what to fix first, why, and what it depends on. This is yours to keep, whether or not you move forward with implementation.",
  },
  {
    number: 4,
    title: "Modular Implementation",
    body: "The right pieces get built and connected, one module at a time, approved as you go. We keep the systems that already work and connect the approved modules around them.",
  },
  {
    number: 5,
    title: "Ongoing Optimization",
    body: "Once something is live, we watch its performance and adjust it as the business changes.",
  },
  {
    number: 6,
    title: "Quarterly Review and Measurable Next Decisions",
    body: "A standing review connects what changed to what it is worth and uses the performance data collected since launch to set the next priority.",
  },
];

function HowWeWorkPage() {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            The process, start to finish
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Start With the{" "}
            <span className="text-brand-primary">Business Problem</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            The first step is understanding what you want to improve and how
            the work happens today. Some problems call for one focused
            implementation. Others cross several systems and deserve a deeper
            Diagnostic before anything is built.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <ol className="space-y-16">
            {steps.map((step) => (
              <li key={step.number} className="relative pl-16">
                <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-lg font-bold text-white">
                  {step.number}
                </div>
                <h2 className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
                  Step {step.number}: {step.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-700">
                  {step.body}
                </p>
                {step.covered ? (
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-brand-secondary">
                      What&apos;s covered
                    </p>
                    <ul className="mt-3 space-y-2">
                      {step.covered.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-sm text-gray-600"
                        >
                          <svg
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
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
