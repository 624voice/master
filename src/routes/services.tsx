import { createFileRoute } from "@tanstack/react-router";
import {
  PlumbingIcon,
  HVACIcon,
  ElectricalIcon,
  PestControlIcon,
  RoofingIcon,
  LawnIcon,
  AIIcon,
  VoiceWaveIcon,
  PhoneRingIcon,
  CalendarIcon,
  StarIcon,
  ChecklistIcon,
} from "~/components/icons";

export const Route = createFileRoute("/services")({
  component: Services,
});

function Services() {
  return (
    <main className="pt-20">
      {/* HERO */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            What We Do
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Your Complete{" "}
            <span className="text-brand-primary">AI Front Desk</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            One system. Every call answered. Every job booked. Every customer
            nurtured. Every dollar captured.
          </p>
        </div>
      </section>

      {/* CORE SERVICE */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              24/7 AI Scheduler & Receptionist
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Every call is answered on the first ring — day or night, weekend
              or holiday. Your AI receptionist handles natural conversations,
              books jobs into your schedule, and never needs a break.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <BenefitCard
              icon={<PhoneRingIcon className="h-6 w-6" />}
              title="First-Ring Answer"
              description="No voicemail, no hold times, no lost calls. Your AI picks up before the second ring."
            />
            <BenefitCard
              icon={<VoiceWaveIcon className="h-6 w-6" />}
              title="Natural Conversation"
              description="Advanced Voice AI that sounds human, understands context, and handles objections like your best dispatcher."
            />
            <BenefitCard
              icon={<CalendarIcon className="h-6 w-6" />}
              title="Smart Scheduling"
              description="Integrates with your calendar to find available slots, book appointments, and send confirmations — all automatically."
            />
            <BenefitCard
              icon={<AIIcon className="h-6 w-6" />}
              title="Multi-Language Support"
              description="Communicate with customers in English or Spanish — your choice, no extra cost."
            />
            <BenefitCard
              icon={<StarIcon className="h-6 w-6" />}
              title="Call Recording & Transcription"
              description="Every call is recorded and transcribed for quality assurance. Never miss a detail."
            />
            <BenefitCard
              icon={<ChecklistIcon className="h-6 w-6" />}
              title="After-Hours Coverage"
              description="Emergency calls routed appropriately. Non-urgent calls scheduled for next day. No call goes unanswered."
            />
          </div>
        </div>
      </section>

      {/* CRM INTEGRATION */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
              Integration
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              Syncs With Your Existing Tools
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              We don't make you change your workflow. We plug into what you
              already use and make it better.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "GHL (GoHighLevel)", trades: ["Plumbing", "HVAC", "Electrical"] },
              { name: "ServiceTitan", trades: ["HVAC", "Plumbing", "Roofing"] },
              { name: "Jobber", trades: ["Lawn", "Pest Control", "Pool"] },
              { name: "Housecall Pro", trades: ["Plumbing", "Electrical", "HVAC"] },
            ].map(
              ({ name, trades }) => (
                <div
                  key={name}
                  className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"
                >
                  <div className="text-lg font-semibold text-brand-secondary">
                    {name}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Seamless two-way sync
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {trades.map((trade) => (
                      <span
                        key={trade}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary"
                      >
                        {trade === "Plumbing" && <PlumbingIcon className="h-3 w-3" />}
                        {trade === "HVAC" && <HVACIcon className="h-3 w-3" />}
                        {trade === "Electrical" && <ElectricalIcon className="h-3 w-3" />}
                        {trade === "Roofing" && <RoofingIcon className="h-3 w-3" />}
                        {trade === "Pest Control" && <PestControlIcon className="h-3 w-3" />}
                        {trade === "Pool" && <PlumbingIcon className="h-3 w-3" />}
                        {trade === "Lawn" && <LawnIcon className="h-3 w-3" />}
                        {trade}
                      </span>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-600">
              <strong className="text-brand-secondary">Add-on:</strong>{" "}
              ServiceTitan integration available for +$500/month with full
              dispatch and job management sync.
            </p>
          </div>
        </div>
      </section>

      {/* REVENUE SERVICES */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
              Revenue Growth
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              Campaigns That Drive Revenue
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Five revenue-generating campaigns per year — designed,
              executed, and optimized for your business — included in your
              monthly plan.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <CampaignCard
              icon={<VoiceWaveIcon className="h-6 w-6" />}
              title="Lost Customer Reactivation"
              description="AI calls past customers who haven't booked in 6+ months. Recover lost revenue automatically."
            />
            <CampaignCard
              icon={<CalendarIcon className="h-6 w-6" />}
              title="Seasonal Promotions"
              description="Targeted campaigns for seasonal services — AC tune-ups in spring, furnace checks in fall, holiday lighting, and more."
            />
            <CampaignCard
              icon={<StarIcon className="h-6 w-6" />}
              title="5-Star Review Generation"
              description="Automated outbound campaign that texts or calls every customer after job completion to request a review."
            />
            <CampaignCard
              icon={<ChecklistIcon className="h-6 w-6" />}
              title="Referral Program"
              description="Identify your happiest customers and invite them to refer friends and neighbors — with automated follow-up."
            />
            <CampaignCard
              icon={<CalendarIcon className="h-6 w-6" />}
              title="Maintenance Reminder"
              description="Schedule-based reminders for recurring services. Never let a loyal customer forget their annual maintenance."
            />
            <CampaignCard
              icon={<AIIcon className="h-6 w-6" />}
              title="Job Closer Agent"
              description="After every completed job, the AI calls the technician to close out the ticket, capture upsell opportunities, and confirm billing."
            />
          </div>
        </div>
      </section>

      {/* QUARTERLY REVIEWS */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
            Accountability
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            Quarterly Business Reviews
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            Every quarter, we sit down with you (video call, in person, or
            detailed report) to review documented revenue recovered and performance metrics.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Calls answered vs. missed",
              "Revenue booked by AI",
              "Revenue gap breakdown",
              "Campaign performance",
              "No-show reduction stats",
              "Optimization recommendations",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm"
              >
                <svg
                  className="h-5 w-5 flex-shrink-0 text-brand-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SUMMARY */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            What's Included
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The Complete Plan
          </h2>
          <div className="mt-10 rounded-2xl border border-gray-700 bg-white/5 p-8 backdrop-blur">
            <div className="space-y-2 text-left">
              <p className="text-sm font-medium text-emerald-400">
                Everything you need to never miss another job:
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  24/7 AI receptionist with conversation flow tuning
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  CRM integration maintenance (GHL, Jobber, Housecall Pro)
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Campaign updates — up to 5 per year
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Quarterly Business Reviews with documented results
                </li>
              </ul>
            </div>
            <div className="mt-6 rounded-lg bg-white/5 p-3 text-center">
              <p className="text-sm text-gray-300">
                <strong className="text-white">Free integrations:</strong> GHL, Jobber, Housecall Pro
              </p>
            </div>
            <a
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
            >
              Get Started
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
        </div>
      </section>

      {/* GUARANTEE */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
            Our Promise
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            90-Day Guarantee
          </h2>
          <p className="mt-6 text-xl leading-relaxed text-gray-700 sm:text-2xl">
            We guarantee you recover more than our service cost in booked revenue —{" "}
            <span className="font-bold text-brand-primary">
              or we keep working, for free, until you do.
            </span>
          </p>
          <div className="mt-8 rounded-lg bg-amber-50 p-4 text-center inline-block">
            <p className="text-sm text-amber-700">
              90-day initial commitment required. Month-to-month after that with 30 days' notice.
            </p>
          </div>
          <a
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
          >
            Start Risk-Free Today
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {description}
      </p>
    </div>
  );
}

function CampaignCard({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-brand-accent-light p-8 transition-all hover:shadow-md">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {description}
      </p>
    </div>
  );
}
