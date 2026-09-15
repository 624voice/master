import { createFileRoute } from "@tanstack/react-router";
import { CustomerLifecycleDiagram } from "~/components/CustomerLifecycleDiagram";
import { FEATURE_FLAGS } from "~/config/features";

export const Route = createFileRoute("/what-we-do")({
  head: () => ({
    meta: [
      {
        title: "AI Growth Systems for Home Service Companies | 624 Voice",
      },
      {
        name: "description",
        content:
          "624 Voice connects the AI tools, automation, and reporting that help growing home-service companies find, respond to, and keep more customers, organized around how the work actually happens.",
      },
    ],
  }),
  component: WhatWeDoPage,
});

type CapabilityCard = {
  title: string;
  description: string;
};

type LifecycleSection = {
  id: string;
  heading: string;
  body: string;
  cards: CapabilityCard[];
  cta?: { label: string; href: string };
};

const reduceManualWorkCards: CapabilityCard[] = [
  {
    title: "CRM Integrations",
    description:
      "Connects the systems you already use so information moves through the process without repeated entry.",
  },
  {
    title: "Workflow Automation",
    description:
      "Automates the routine handoffs and notifications between tools.",
  },
  {
    title: "Responsible Data Movement",
    description:
      "Moves customer and job data between systems accurately, with a clear audit trail.",
  },
];

if (FEATURE_FLAGS.SHOW_PAYMENT_BALANCE_CARD) {
  reduceManualWorkCards.push({
    title: "Administrative Payment and Balance Reminders",
    description:
      "Routine, first-party reminders for your own completed-work invoices, with any dispute, hardship, or legal question handed to a person immediately. Not debt collection.",
  });
}

const lifecycleSections: LifecycleSection[] = [
  {
    id: "get-found",
    heading: "Get Found: Can the right homeowners find you and trust what they see?",
    body: "If your website is slow, thin on real information, or hard for search and AI tools to understand, some of this starts before the phone ever rings. This is the first link in the chain: nothing downstream matters yet if people can't find you or don't trust what they find.",
    cards: [
      {
        title: "SEO-Ready Websites",
        description:
          "New websites and redesigns built to load quickly, explain your services clearly, and give search engines useful information about the areas you serve.",
      },
      {
        title: "Local Search Optimization",
        description:
          "Google Business Profile, local listings, and the on-page details that help you show up for nearby searches.",
      },
      {
        title: "AI Discoverability Consulting",
        description:
          "Organizing your services, service areas, credentials, and FAQs so search engines and AI assistants can accurately understand your business.",
      },
    ],
    cta: { label: "See How the Journey Fits Together", href: "/how-we-work" },
  },
  {
    id: "respond",
    heading: "Respond: Do you answer fast enough to win the job?",
    body: "A homeowner's need is often immediate. A fast, useful response gives the business a better chance to answer the question, capture the details, and move the request forward. You can hear this stage for yourself in the Live Demo.",
    cards: [
      {
        title: "Voice AI Receptionists",
        description:
          "Answers calls, takes down what's needed, and can schedule or route the request, day or night.",
      },
      {
        title: "Voice and Text Speed-to-Lead",
        description:
          "Follows up on new leads within minutes by voice or text, before the moment passes.",
      },
      {
        title: "AI Chatbots",
        description:
          "Answers common questions and captures details on your website when a visitor doesn't want to call.",
      },
    ],
    cta: { label: "Try the Live Demo", href: "/demo" },
  },
  {
    id: "convert",
    heading: "Convert: Do responded-to leads actually become booked jobs?",
    body: "Responding is only part of the job. Estimates still need consistent follow-up, clear ownership, and enough visibility to understand why an opportunity moved forward or stopped.",
    cards: [
      {
        title: "Automated Estimate Follow-Up",
        description:
          "Keeps a quote from going cold by following up on a schedule, without relying on someone remembering to.",
      },
      {
        title: "CRM-Connected Follow-Up Workflows",
        description:
          "Connects your CRM to the follow-up work so a lead's status and history move with it instead of living in someone's head.",
      },
    ],
    cta: { label: "See What a Consultation Covers", href: "/how-we-work" },
  },
  {
    id: "retain-and-grow",
    heading: "Retain and Grow: Do you keep and grow the customers you already have?",
    body: "The relationship can continue after the job closes. Timely review requests, useful reminders, relevant offers, and thoughtful reactivation can help a good customer stay connected.",
    cards: [
      {
        title: "Automated Google-Review Systems",
        description:
          "Asks for reviews at the right moment, consistently, instead of whenever someone remembers to.",
      },
      {
        title: "Upsell Campaigns",
        description:
          "Surfaces relevant add-on or seasonal offers to customers who already trust you.",
      },
      {
        title: "Customer Reminders",
        description:
          "Service and maintenance reminders that bring a customer back before they call a competitor.",
      },
      {
        title: "Reactivation Campaigns",
        description:
          "Reconnects with past customers who haven't booked in a while.",
      },
    ],
    cta: { label: "See How the Journey Fits Together", href: "/how-we-work" },
  },
  {
    id: "reduce-manual-work",
    heading: "Reduce Manual Work: Is the business still running on manual effort?",
    body: "Routine administrative work adds up. We connect systems, automate appropriate handoffs, and keep people responsible for exceptions that require judgment.",
    cards: reduceManualWorkCards,
  },
  {
    id: "measure-and-improve",
    heading: "Measure and Improve: Can you see whether any of this is working?",
    body: "Improvement needs evidence. Reporting and regular reviews connect day-to-day activity with the business outcomes used to choose the next priority.",
    cards: [
      {
        title: "Custom Dashboards and Reporting",
        description:
          "A clear view of leads, response, booking, and revenue in one place instead of scattered across systems.",
      },
      {
        title: "AI Tool Assessments",
        description:
          "An honest look at what's already in place and what's actually earning its keep.",
      },
      {
        title: "KPI Reviews",
        description:
          "Regular check-ins on the numbers that matter for your business specifically.",
      },
      {
        title: "Quarterly Business Reviews",
        description:
          "A standing meeting that connects what changed to what it's worth, and sets the next priority.",
      },
    ],
    cta: {
      label: "Book Your AI Growth Systems Consultation",
      href: "/contact",
    },
  },
];

function SectionCta({ label, href }: { label: string; href: string }) {
  return (
    <div className="mt-10">
      <a
        href={href}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
      >
        {label}
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </a>
    </div>
  );
}

function WhatWeDoPage() {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            How it all fits together
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Improve the Customer Journey{" "}
            <span className="text-brand-primary">One Priority at a Time</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Home-service companies rarely need every AI tool on the market. They
            need the parts of the customer journey that lose opportunities, slow
            down the office, or hide results to work better together. We identify
            the first priority, build the right capability, and connect it with
            the tools worth keeping.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <CustomerLifecycleDiagram />
        </div>
      </section>

      {lifecycleSections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className={
            index % 2 === 0
              ? "bg-brand-accent-light px-6 py-24 sm:py-32"
              : "bg-white px-6 py-24 sm:py-32"
          }
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold tracking-tight text-brand-secondary sm:text-3xl">
              {section.heading}
            </h2>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-700">
              {section.body}
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-base font-semibold text-brand-secondary">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
            {section.cta ? (
              <SectionCta label={section.cta.label} href={section.cta.href} />
            ) : null}
          </div>
        </section>
      ))}

      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg leading-relaxed text-gray-300">
            We recommend the right priorities for your business, not every tool
            on this page. A Consultation is the fastest way to find out which of
            these six areas is actually worth fixing first.
          </p>
          <p className="mt-4 text-sm text-gray-400">
            The right scope depends on where your operation needs attention now.
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
