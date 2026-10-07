import { createFileRoute } from "@tanstack/react-router";
import { FloatingTradeIcons } from "~/components/icons";
import { HomeJessicaPreview } from "~/components/marketing/HomeJessicaPreview";
import {
  JourneyStageCard,
  ProblemPainCard,
  ProcessStepCard,
} from "~/components/marketing/MarketingCards";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";
import { CLIENT_ENGAGEMENT_STEPS } from "~/content/clientEngagementProcess";
import { CUSTOMER_JOURNEY_STAGES } from "~/content/customerJourneyStages";
import { PUBLIC_CTA } from "~/content/publicConversion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "AI Growth Systems for Home Services | 624 Voice",
      },
      {
        name: "description",
        content:
          "624 Voice finds the gaps between your website, phones, estimates, follow-up, and customer data. Connect AI agents, automation, integrations, and reporting around the way your business already runs.",
      },
    ],
  }),
  component: Home,
});

const PROBLEM_CARDS = [
  {
    title: "Missed or delayed response",
    body: "Calls go to voicemail or web leads wait because the team is already on a job.",
    iconId: "phone",
  },
  {
    title: "Forgotten estimate follow-up",
    body: "The quote goes out, but follow-up depends on memory and spare time.",
    iconId: "calendar",
  },
  {
    title: "Inactive past customers",
    body: "Finished jobs do not reliably turn into reviews, reminders, or the next booking.",
    iconId: "heart",
  },
  {
    title: "Disconnected tools and manual work",
    body: "Information gets copied between systems while the owner pieces together what is working.",
    iconId: "gears",
  },
] as const;

const APPROVED_HERO_HEADLINE =
  "Turn More Leads Into Booked Work and Keep Customers Coming Back";

const PROCESS_ICONS = ["compass", "chart", "gears", "phone"] as const;

const HOME_PROCESS_BODY: Record<number, string> = {
  1: "Find where leads, time, and visibility are being lost in the business today.",
  2: "Set priorities, scope, integrations, and measures of success before building.",
  3: "Connect approved capabilities with the tools and processes worth keeping.",
  4: "Measure performance and decide what deserves attention next.",
};

function Home() {
  return (
    <main>
      {/* 1 — Hero */}
      <section className="relative overflow-hidden bg-brand-secondary px-6 pt-28 pb-20 sm:pt-32 sm:pb-24">
        <FloatingTradeIcons className="motion-reduce:opacity-[0.04]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25px 25px, white 1px, transparent 0)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            <span
              className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse"
              aria-hidden="true"
            />
            AI Agents Available 24/7/365
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <span className="text-white">{APPROVED_HERO_HEADLINE.split("Booked Work")[0]}</span>
            <span className="text-brand-primary">Booked Work</span>
            <span className="text-white">{APPROVED_HERO_HEADLINE.split("Booked Work")[1]}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            624 Voice finds the gaps between your website, phones, estimates,
            follow-up, and customer data, then connects the right AI agents,
            automation, and reporting around how your business already runs.
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-4 sm:items-center">
            <a
              href="/demo"
              data-analytics-intent="home_primary_demo"
              className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark"
            >
              Talk With Our AI Voice Agent
            </a>
            <a
              href={PUBLIC_CTA.assessmentHref}
              data-analytics-intent="home_secondary_assessment"
              className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-gray-400 hover:bg-white/5"
            >
              {PUBLIC_CTA.estimateLostRevenue}
            </a>
          </div>
        </div>
      </section>

      {/* 2 — Where revenue is leaking */}
      <section className="bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrowClass="text-rose-600 bg-rose-50"
            eyebrow="Your Revenue Is Leaking"
            headline="Where Revenue Is Slipping Away"
            supporting="The leads are coming in and the work is getting done. The trouble is everything that has to happen in between, especially when the office is busy or closed."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEM_CARDS.map((card) => (
              <ProblemPainCard
                key={card.title}
                title={card.title}
                body={card.body}
                icon={<JourneyStageIcon iconId={card.iconId} className="h-6 w-6" />}
              />
            ))}
          </div>
          <div className="mt-10 rounded-xl bg-brand-secondary px-6 py-5 text-center sm:px-10">
            <p className="text-base font-medium leading-relaxed text-white sm:text-lg">
              These small gaps add up. They also make growth harder because more
              work creates more follow-up for the same team.
            </p>
          </div>
        </div>
      </section>

      {/* 3 — Talk with Jessica */}
      <section className="bg-brand-accent-light px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Live AI voice demo"
            headline="Never Let Another Good Call Go Unanswered"
            supporting="Hear how Jessica answers in a natural conversation and moves qualified callers toward the right next step."
          />
          <div className="mt-12">
            <HomeJessicaPreview />
          </div>
        </div>
      </section>

      {/* 4 — Revenue gap + assessment */}
      <section className="bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHeader
            eyebrow="Find Your Lost Revenue"
            headline="See Where Revenue Is Slipping Away"
            supporting="One free revenue assessment models missed-call opportunity and broader operational priorities across six areas."
          />
          <div className="mt-12 mx-auto max-w-xl">
            <ToolCard
              title={PUBLIC_CTA.freeRevenueAssessment}
              body="Trade, fleet size, call volume, and operational questions in one flow, with a modeled opportunity estimate and combined on-screen results."
              primaryHref={PUBLIC_CTA.assessmentHref}
              primaryLabel={PUBLIC_CTA.estimateLostRevenue}
              primaryHint="About 3-5 minutes total."
              dataIntent="home_assessment_tool"
            />
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-gray-500">
            Get your complete results and personalized report by email. Text
            updates are optional.
          </p>
        </div>
      </section>

      {/* 5 — Six-area capability grid */}
      <section className="bg-brand-accent-light px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="What we improve"
            headline="Turn More Opportunities Into Revenue"
            supporting="Most companies do not need all six at once. The first job is finding which part is holding back the rest."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTOMER_JOURNEY_STAGES.map((stage) => (
              <JourneyStageCard
                key={stage.id}
                primaryLabel={stage.primaryLabel}
                description={stage.description}
                iconId={stage.iconId}
                accentClass={stage.accentClass}
              />
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="/what-we-do"
              className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark"
            >
              Explore What We Do
            </a>
          </div>
        </div>
      </section>

      {/* 6 — How we work (compressed) */}
      <section className="bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="A practical path"
            headline="From Revenue Leak to Revenue Machine"
            supporting="We begin with how the business works today, then define outcomes, build what is needed, and review results together."
          />
          <ol className="mx-auto mt-12 grid max-w-5xl list-none gap-6 p-0 lg:grid-cols-2">
            {CLIENT_ENGAGEMENT_STEPS.map((step, index) => (
              <li key={step.step} className="list-none">
                <ProcessStepCard
                  step={step.step}
                  title={step.title}
                  body={HOME_PROCESS_BODY[step.step] ?? step.body}
                  deliverable={step.deliverable}
                  icon={
                    <JourneyStageIcon
                      iconId={PROCESS_ICONS[index] ?? "chart"}
                      className="h-6 w-6"
                    />
                  }
                />
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <a
              href="/how-we-work"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
            >
              See How We Work
              <ArrowIcon />
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}

function ToolCard({
  title,
  body,
  primaryHref,
  primaryLabel,
  primaryHint,
  dataIntent,
}: {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  primaryHint: string;
  dataIntent: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h3 className="text-xl font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{body}</p>
      <a
        href={primaryHref}
        data-analytics-intent={dataIntent}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark"
      >
        {primaryLabel}
      </a>
      <p className="mt-2 text-xs text-gray-500">{primaryHint}</p>
    </article>
  );
}

function Eyebrow({
  children,
  variant = "light",
}: {
  children: React.ReactNode;
  variant?: "light" | "dark";
}) {
  const classes =
    variant === "dark"
      ? "rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400"
      : "rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary";

  return <span className={`inline-block ${classes}`}>{children}</span>;
}

function SectionHeader({
  eyebrow,
  headline,
  supporting,
  eyebrowClass,
}: {
  eyebrow: string;
  headline: string;
  supporting: string;
  eyebrowClass?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span
        className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
          eyebrowClass ?? "bg-emerald-50 text-brand-primary"
        }`}
      >
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
        {headline}
      </h2>
      <p className="mt-6 text-lg leading-relaxed text-gray-600">{supporting}</p>
    </div>
  );
}

function ArrowIcon() {
  return (
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
  );
}
