import { createFileRoute } from "@tanstack/react-router";
import { CustomerLifecycleDiagram } from "~/components/CustomerLifecycleDiagram";
import { FloatingTradeIcons } from "~/components/icons";
import { PUBLIC_CTA } from "~/content/publicConversion";

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

const lifecycleSections: LifecycleSection[] = [
  {
    id: "get-found",
    heading: "Get Found: Can the right homeowners find you and trust what they see?",
    body: "If your website is slow, thin on real information, or hard for search and AI tools to understand, some of this starts before the phone ever rings. This is the first link in the chain: nothing downstream matters yet if people can't find you or don't trust what they find.",
    cards: [
      {
        title: "Help Homeowners Find You Online",
        description:
          "Websites and redesigns that load quickly, explain your services clearly, and give search engines useful information about the areas you serve.",
      },
      {
        title: "Show Up in Local Search",
        description:
          "Google Business Profile, local listings, and on-page details that help you appear for nearby searches.",
      },
      {
        title: "Get Found in Search and AI Answers",
        description:
          "Services, service areas, credentials, and FAQs organized so search engines and AI assistants understand your business accurately.",
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
        title: "Book More Jobs",
        description:
          "Voice AI receptionists that answer calls, capture what is needed, and schedule or route the request day or night.",
      },
      {
        title: "Respond in Minutes, Not Hours",
        description:
          "Voice and text speed-to-lead that follows up within minutes before the moment passes.",
      },
      {
        title: "Capture Web Visitors Who Won't Call",
        description:
          "AI chat that answers common questions and collects details when a visitor prefers not to pick up the phone.",
      },
    ],
    cta: { label: "Try the Live Demo", href: PUBLIC_CTA.demoHref },
  },
  {
    id: "convert",
    heading: "Convert: Do responded-to leads actually become booked jobs?",
    body: "Responding is only part of the job. Estimates still need consistent follow-up, clear ownership, and enough visibility to understand why an opportunity moved forward or stopped.",
    cards: [
      {
        title: "Turn More Quotes Into Booked Jobs",
        description:
          "Automated estimate follow-up on a schedule instead of relying on memory and spare time.",
      },
      {
        title: "Keep Follow-Up Out of Someone's Head",
        description:
          "CRM-connected workflows so lead status and history move with the work.",
      },
      {
        title: "Cut Your No-Shows",
        description:
          "Confirmations and reminders that protect booked capacity before the truck rolls.",
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
        title: "Win More Repeat Revenue",
        description:
          "Reactivation and seasonal outreach that turns your customer list into recurring demand.",
      },
      {
        title: "Raise Your Average Ticket",
        description:
          "Relevant add-on and seasonal offers surfaced while trust is still high.",
      },
      {
        title: "Bring Customers Back Before They Call a Competitor",
        description:
          "Service and maintenance reminders that keep good customers on your calendar.",
      },
      {
        title: "Voice AI Outbound Collections",
        description:
          "First-party payment and balance reminders for your own completed-work invoices, with disputes, hardship, or legal questions handed to a person immediately. Not debt collection.",
      },
    ],
    cta: { label: "See How the Journey Fits Together", href: "/how-we-work" },
  },
  {
    id: "reduce-manual-work",
    heading: "Get Your Time Back: Is the business still running on manual effort?",
    body: "Routine administrative work adds up. We connect systems, automate appropriate handoffs, and keep people responsible for exceptions that require judgment.",
    cards: [
      {
        title: "Connect the Tools You Already Use",
        description:
          "CRM integrations so information moves through the process without repeated entry.",
      },
      {
        title: "Automate Routine Handoffs",
        description:
          "Workflow automation for the notifications and transfers between tools.",
      },
      {
        title: "Move Data Without Retyping It",
        description:
          "Responsible data movement between systems with a clear audit trail.",
      },
    ],
  },
  {
    id: "measure-and-improve",
    heading: "Measure and Improve: Can you see whether any of this is working?",
    body: "Improvement needs evidence. Reporting and regular reviews connect day-to-day activity with the business outcomes used to choose the next priority.",
    cards: [
      {
        title: "See What's Working in One Place",
        description:
          "Custom dashboards for leads, response, booking, and revenue instead of scattered reports.",
      },
      {
        title: "Review the Numbers That Matter",
        description:
          "KPI reviews focused on the measures your business actually uses to decide.",
      },
      {
        title: "Connect Changes to Business Results",
        description:
          "Quarterly business reviews that tie operational changes to outcomes and set the next priority.",
      },
    ],
    cta: {
      label: PUBLIC_CTA.exploreOptions,
      href: PUBLIC_CTA.exploreOptionsHref,
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
      <section className="relative overflow-hidden bg-brand-secondary px-6 py-24 sm:py-32">
        <FloatingTradeIcons className="motion-reduce:opacity-[0.04]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            What we improve
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Fix the Gaps Costing You{" "}
            <span className="text-brand-primary">Leads, Time and Revenue</span>
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
          <CustomerLifecycleDiagram showHeadline compact />
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
            Tell us where leads, follow-up, or routine work are slowing the
            business down. We&apos;ll help you choose a sensible first priority.
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
