import { createFileRoute } from "@tanstack/react-router";
import { CustomerLifecycleDiagram } from "~/components/CustomerLifecycleDiagram";
import {
  JourneyStageCard,
  OutcomeCard,
  ProcessStepCard,
  ProofHighlightCard,
} from "~/components/marketing/MarketingCards";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";
import { FEATURE_FLAGS } from "~/config/features";
import { CLIENT_ENGAGEMENT_STEPS } from "~/content/clientEngagementProcess";
import { CUSTOMER_JOURNEY_STAGES } from "~/content/customerJourneyStages";

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
    title: "Response depends on who is free",
    body: "A call goes to voicemail or a web lead sits for hours because everyone is already helping someone else.",
    iconId: "phone",
    accent: "mint" as const,
  },
  {
    title: "Estimates rely on memory",
    body: "The quote goes out. Follow-up happens when someone remembers, has time, and knows what was said last.",
    iconId: "calendar",
    accent: "aqua" as const,
  },
  {
    title: "Past customers go quiet",
    body: "The job is finished, but review requests, service reminders, and future offers are inconsistent.",
    iconId: "heart",
    accent: "sky" as const,
  },
  {
    title: "Your team holds the tools together",
    body: "Information gets copied from one place to another, and the owner still has to piece together what is working.",
    iconId: "gears",
    accent: "neutral" as const,
  },
] as const;

const HOME_DEMO_BODY =
  "Hear how a natural AI receptionist can answer questions, understand what a caller needs, and move the conversation toward the right outcome—all while creating an experience designed around your business and customers.";

const PROCESS_ICONS = ["compass", "chart", "gears", "phone"] as const;

function Home() {
  const broaderProblemCopy = FEATURE_FLAGS.SHOW_DIAGNOSTIC_CREDIT_MENTION
    ? "A paid AI Revenue and Operations Diagnostic takes a deeper look at the customer journey, workflows, data, risks, priorities, and measurement plan. You keep the roadmap. Its fee may be credited toward qualifying implementation work."
    : "A paid AI Revenue and Operations Diagnostic takes a deeper look at the customer journey, workflows, data, risks, priorities, and measurement plan. You keep the roadmap.";

  return (
    <main>
      {/* 1 — Hero */}
      <section className="relative overflow-hidden bg-brand-secondary px-6 pt-28 pb-20 sm:pt-32 sm:pb-24">
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
          <Eyebrow variant="dark">AI Growth Systems for Home Services</Eyebrow>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
            Turn More Leads Into Booked Work and Keep Customers Coming Back
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            624 Voice finds the gaps between your website, phones, estimates,
            follow-up, and customer data. Then we connect the right AI agents,
            automation, integrations, and reporting around the way your business
            already runs.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <PrimaryButton href="/contact">
              Book Your AI Growth Systems Consultation
            </PrimaryButton>
            <SecondaryButton href="/assessment" variant="dark">
              Get Your Free Assessment
            </SecondaryButton>
          </div>
          <a
            href="/demo"
            className="mt-6 inline-block text-sm font-semibold text-brand-primary transition-colors hover:text-brand-primary-dark"
          >
            See the System Work
          </a>
          <p className="mt-8 text-sm text-gray-400">
            Built for growing home-service companies with fewer than 50 trucks.
          </p>
        </div>
      </section>

      {/* 2 — Problem Recognition */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Where opportunity gets stuck"
            headline="Does This Sound Like a Normal Week?"
            supporting="The leads are coming in and the work is getting done. The trouble is everything that has to happen between those two points, especially when the office is busy or even closed."
          />
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEM_CARDS.map((card) => (
              <OutcomeCard
                key={card.title}
                title={card.title}
                body={card.body}
                accent={card.accent}
                icon={<JourneyStageIcon iconId={card.iconId} className="h-6 w-6" />}
              />
            ))}
          </div>
          <p className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-gray-500">
            These small gaps add up. They also make growth harder because more
            work creates more follow-up for the same team.
          </p>
        </div>
      </section>

      {/* 3 — Reframe */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Why the same problems keep coming back"
            headline="The Gaps Are Connected."
            supporting="A faster response will not help if the estimate is forgotten. More website traffic will not help if the phone goes unanswered. A completed job will not create the next one if the customer never hears from you again."
          />
          <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-relaxed text-gray-600">
            624 Voice looks at the full path a customer takes through your
            business. That makes it easier to fix the right part first and
            connect each improvement to what happens next.
          </p>
          <CustomerLifecycleDiagram
            className="mt-16"
            showHeadline={false}
            showNote={false}
          />
          <div className="mt-12 text-center">
            <a
              href="#customer-lifecycle"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
            >
              See How the Customer Journey Fits Together
              <ArrowIcon />
            </a>
            <p className="mt-6 text-sm text-gray-500">
              Keep the tools that work. Fix the handoffs that do not.
            </p>
          </div>
        </div>
      </section>

      {/* 4 — Customer Lifecycle */}
      <section
        id="customer-lifecycle"
        className="bg-white px-6 py-24 sm:py-32 scroll-mt-24"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="From the first search to the next service call"
            headline="Six Parts of the Customer Journey We Can Improve"
            supporting="Most companies do not need all six at once. The first job is finding which part is holding back the rest."
          />
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-12 text-center">
            <a
              href="/what-we-do"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark"
            >
              Explore What We Do
            </a>
            <p className="mt-6 text-sm text-gray-500">
              Your roadmap determines the order. The service list does not.
            </p>
          </div>
        </div>
      </section>

      {/* 5 — Live Demonstration */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Hear a Natural AI Conversation</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            Meet the AI Voice Experience Your Customers Could Hear
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-gray-600">{HOME_DEMO_BODY}</p>
          <a
            href="/demo"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-dark sm:mt-10"
          >
            Hear the Live AI Demo
          </a>
        </div>
      </section>

      {/* 6 — How We Work */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="A practical path from problem to results"
            headline="How We Work, at a Glance"
            supporting="We begin with how the business works today, not with a package of tools. From there, we define the outcome, build what is needed, and review the results with you."
          />
          <ol className="mx-auto mt-16 grid max-w-5xl list-none gap-6 p-0 lg:grid-cols-2">
            {CLIENT_ENGAGEMENT_STEPS.map((step, index) => (
              <li key={step.step} className="list-none">
              <ProcessStepCard
                key={step.step}
                step={step.step}
                title={step.title}
                body={step.body}
                deliverable={step.deliverable}
                note={step.step === 1 ? step.noteUnderStep1 : undefined}
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
          <div className="mt-12 text-center">
            <a
              href="/how-we-work"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
            >
              See How We Work
              <ArrowIcon />
            </a>
            <p className="mt-6 text-sm text-gray-500">
              If one focused project will solve the problem, we scope it. If the
              issue is broader, we may recommend a paid Diagnostic first.
            </p>
          </div>
        </div>
      </section>

      {/* 7 — Free Assessment */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Prefer to start on your own?</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            Get a Read on Your Business First
          </h2>
          <a
            href="/assessment"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark sm:hidden"
          >
            Get Your Free Assessment
          </a>
          <p className="mt-8 text-lg leading-relaxed text-gray-600 sm:mt-6">
            Answer a short set of questions about how your business gets found,
            responds, converts, retains customers, handles routine work, and
            measures results. You will receive a six-area snapshot, a modeled
            estimate of the opportunity tied to missed calls, and a report you
            can use to prepare for the next conversation. It is a starting point,
            not the full operational diagnosis provided through the paid
            Diagnostic.
          </p>
          <a
            href="/assessment"
            className="mt-10 hidden items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark sm:inline-flex"
          >
            Get Your Free Assessment
          </a>
          <p className="mt-8 text-sm text-gray-500">
            Contact information unlocks the complete results and report.
            Text-message consent is separate and optional.
          </p>
        </div>
      </section>

      {/* 8 — Consultation and Diagnostic */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="What happens when you reach out"
            headline="One Conversation to Decide the Best Next Step"
            supporting="The free AI Growth Systems Consultation is about 30 minutes. We will discuss the result you want, where opportunities tend to slow down, how the work happens today, and what tools are already in place."
          />
          <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
            <TextCard
              title="When the problem is clear"
              body="We can define a focused project, the outcome it should produce, and the systems it needs to work with."
            />
            <TextCard
              title="When the problem is broader"
              body={broaderProblemCopy}
            />
          </div>
          <div className="mt-12 text-center">
            <PrimaryButton href="/contact">
              Book Your AI Growth Systems Consultation
            </PrimaryButton>
            <p className="mt-6 text-sm text-gray-500">
              The conversation may lead to a project, a Diagnostic, or a
              decision that nothing needs to change right now.
            </p>
          </div>
        </div>
      </section>

      {/* 9 — Accountability */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <SectionHeader
            eyebrow="After launch"
            headline="See What You Are Getting and What It Is Producing"
            supporting="Before implementation, we agree on the problem, scope, success measures, and reporting. After launch, we review performance, improve the experience, and use quarterly business reviews to decide what should happen next."
          />
          <div className="mt-12 space-y-6">
            {FEATURE_FLAGS.SHOW_VOICE_AI_GUARANTEE ? (
              <ProofHighlightCard
                title="Implementation and Optimization Commitment"
                body="The 90-day revenue guarantee applies only to qualifying Voice AI and Speed-to-Lead engagements where sufficient baseline data exists. Every other engagement includes an agreed scope, defined launch criteria, transparent reporting, and continued optimization."
              />
            ) : (
              <ProofHighlightCard
                title="Clear Expectations for Every Engagement"
                body="Before implementation begins, we agree on the problem, scope, launch criteria, measures of success, and reporting. After launch, we review performance, improve the experience, and determine what deserves attention next."
              />
            )}
          </div>
          <div className="mt-12 text-center">
            <a
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
            >
              Discuss What Success Should Look Like
              <ArrowIcon />
            </a>
            {FEATURE_FLAGS.SHOW_VOICE_AI_GUARANTEE ? (
              <p className="mt-6 text-sm text-gray-500">
                Text-only agents are outside the 90-Day Results Guarantee. The
                written agreement controls eligibility, attribution, and remedy.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* 10 — Experience and Values */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Why 624 Voice</Eyebrow>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            More Than 18 Years Across Communications, Technology, and Customer
            Operations
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            624 Voice brings more than 18 years of experience across business
            communications, enterprise technology, customer experience, contact
            centers, and modernization to growing home-service companies. That
            work now includes enterprise AI agents and customer operations.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            We believe good stewardship means solving the right problem, being
            honest about what technology can do, and building something your team
            can actually use.
          </p>
          <a
            href="/about"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
          >
            About 624 Voice
            <ArrowIcon />
          </a>
        </div>
      </section>

      {/* 11 — Final CTA */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Start with the constraint that matters most
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find Out What Is Worth Fixing First
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            If you can already see the problem, book a consultation and we will
            talk through the most sensible next step. If you want a broader view
            first, complete the Free Assessment and bring the results with you.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <PrimaryButton href="/contact">
              Book Your AI Growth Systems Consultation
            </PrimaryButton>
            <SecondaryButton href="/assessment" variant="dark">
              Get Your Free Assessment
            </SecondaryButton>
          </div>
          <p className="mt-8 text-sm text-gray-400">
            About 30 minutes. Focused on your business, current process, and
            next decision.
          </p>
        </div>
      </section>
    </main>
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

  return (
    <span className={`inline-block ${classes}`}>{children}</span>
  );
}

function SectionHeader({
  eyebrow,
  headline,
  supporting,
}: {
  eyebrow: string;
  headline: string;
  supporting: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
        {headline}
      </h2>
      <p className="mt-6 text-lg leading-relaxed text-gray-600">{supporting}</p>
    </div>
  );
}

function TextCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">{body}</p>
    </div>
  );
}

function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30"
    >
      {children}
    </a>
  );
}

function SecondaryButton({
  href,
  children,
  variant = "light",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "light" | "dark";
}) {
  const classes =
    variant === "dark"
      ? "border border-gray-600 text-white hover:border-gray-400 hover:bg-white/5"
      : "border border-gray-300 text-brand-secondary hover:border-brand-primary hover:bg-brand-primary/5";

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold transition-all ${classes}`}
    >
      {children}
    </a>
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
