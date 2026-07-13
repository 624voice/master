import { createFileRoute } from "@tanstack/react-router";
import {
  PlumbingIcon,
  HVACIcon,
  ElectricalIcon,
  PestControlIcon,
  RoofingIcon,
  PoolIcon,
  LawnIcon,
  AIIcon,
  VoiceWaveIcon,
  PhoneRingIcon,
  RevenueIcon,
  FloatingTradeIcons,
} from "~/components/icons";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main>
      {/* ========== HERO ========== */}
      <section className="relative min-h-dvh overflow-hidden bg-brand-secondary">
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" 
            style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, white 1px, transparent 0)`,
              backgroundSize: "50px 50px"
            }}
          />
        </div>
        {/* Floating trade icons */}
        <FloatingTradeIcons />
        <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Available 24/7/365 — First Ring Answer
          </div>
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Answer Every Call.{" "}
            <span className="text-brand-primary">Every Time.</span>{" "}
            Never Miss a Job Again.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            624 Voice helps home services companies recover their time,
            family, and freedom — while AI handles the phones, books the jobs,
            and grows the revenue. 24/7. On the first ring.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="/contact"
              className="rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30"
            >
              See It In Action
            </a>
            <a
              href="/services"
              className="rounded-lg border border-gray-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-gray-400 hover:bg-white/5"
            >
              Explore Services
            </a>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-primary sm:text-4xl">
                100%
              </div>
              <div className="mt-1 text-sm text-gray-400">
                First-Ring Answer Rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-primary sm:text-4xl">
                24/7
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Never Miss a Call
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-primary sm:text-4xl">
                90 Day
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Risk-Free Guarantee
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-primary sm:text-4xl">
                $75k+
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Revenue you&apos;re missing (1–2 trucks)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== THE PROBLEM ========== */}
      <section className="bg-white px-6 py-24 sm:py-32 animate-fade-in">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
              The Problem
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              You Didn't Build a Business to Be a Slave to It
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              You started your home services company to build something for your
              family. But somewhere along the way, the business started owning
              you instead of the other way around.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="group relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-md animate-slide-up animate-delay-100">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 8v4m0 4h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Missed Calls Are Costing You
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Industry average says companies miss 20-40% of calls — they have no after hours solution or the owner is on call 24/7.
              </p>
            </div>
            <div className="group relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-md animate-slide-up animate-delay-200">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Lost Revenue From Past Customers
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Past customers often need more work but never get contacted again. Technicians forget job details and companies miss follow up revenue opportunities.
              </p>
            </div>
            <div className="group relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-md animate-slide-up animate-delay-300">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                No-Shows & Scheduling Chaos
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Customer no-shows leaves gaps in schedule and waste tech time. Manual scheduling creates mistakes, delays, and dropped leads.
              </p>
            </div>
          </div>
          <div className="mt-8 rounded-xl bg-brand-secondary p-6 shadow-lg animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-primary/20">
                <svg className="h-5 w-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  The hidden cost
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-300">
                  Without call recordings, booking logs, and reporting, it is hard to know what was missed, booked, or recovered. The business depends too much on one person answering phones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== THE SOLUTION ========== */}
      <section className="bg-brand-accent-light py-24 sm:py-32 animate-slide-up">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
              The Solution
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              Your AI-Powered Front Desk
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Imagine every call answered on the first ring. Jobs booked
              automatically. Customers reminded. Reviews requested. Revenue
              campaigns running in the background. All while you focus on the
              work and the people who matter.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              }
              title="24/7 AI Scheduler & Receptionist"
              description="Every call answered on the first ring — never voicemail, never a missed opportunity. Natural conversation that books jobs like your best dispatcher."
              trades={["Plumbing", "HVAC", "Electrical", "Roofing"]}
            />
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              }
              title="CRM Integration"
              description="Seamlessly syncs with GHL, ServiceTitan, Jobber, and Housecall Pro. Your existing workflows stay exactly the same — just better."
              trades={["GHL", "ServiceTitan", "Jobber", "Housecall Pro"]}
            />
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              }
              title="Automated Confirmations & Reminders"
              description="Dramatically reduce no-shows with automated two-way confirmations and reminders via voice and text. Your schedule stays full and predictable."
              trades={["Text", "Voice", "Email"]}
            />
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              }
              title="5 Revenue Campaigns / Year"
              description="Included in your plan: reactivation campaigns for lost customers, seasonal promotions, review generation, referral campaigns, and more."
              trades={["Reactivation", "Seasonal", "Referral"]}
            />
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              }
              title="Outbound 5-Star Review Campaign"
              description="Automatically request reviews after every completed job. Build your online reputation on autopilot and watch your ratings soar."
              trades={["Google", "Yelp", "Facebook"]}
            />
            <FeatureCard
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              }
              title="Job Closer Agent"
              description="After each job, the AI calls the tech to confirm completion and capture next-steps. No more paperwork falling through the cracks."
              trades={["Confirmation", "Upsells", "Billing"]}
            />
          </div>
        </div>
      </section>

      {/* ========== SEE YOUR NUMBER ========== */}
      <section className="bg-white py-24 sm:py-32 animate-fade-in">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
            See Your Number
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            Most Owners Don&apos;t Know How Much Revenue Walks Out the Door
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            Missed calls, no-shows, and quiet past customers add up fast. Run
            the free calculator and see what your operation is leaving on the
            table — in under a minute.
          </p>
          <a
            href="/roi-calculator"
            className="mt-10 inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30"
          >
            Find Out What You&apos;re Missing
          </a>
          <div className="mt-12 rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6 sm:p-8 text-left sm:text-center">
            <h3 className="font-emphasis text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
              90-Day <span className="text-brand-primary">Results Guarantee</span>
            </h3>
            <p className="mt-4 font-body text-base leading-relaxed text-brand-secondary">
              We guarantee you recover at least our service investment in booked
              service-visit revenue within 90 days of go-live —{" "}
              <span className="font-semibold text-brand-primary">
                or we keep working, for free, until you do.
              </span>
            </p>
            <p className="mt-3 font-body text-base leading-relaxed text-brand-secondary">
              If we don&apos;t perform, you don&apos;t pay beyond the{" "}
              <span className="font-medium">Results Engagement Period</span>.
            </p>
          </div>
        </div>
      </section>

      {/* ========== WHAT YOU GET ========== */}
      <section className="bg-brand-accent-light py-24 sm:py-32 animate-slide-up">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
              What You Get
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              <span className="block">Everything You Need</span>
              <span className="block mt-1">Never Miss Another Job</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              One plan. Every tool included. Results guaranteed.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="rounded-2xl border-2 border-brand-primary bg-white p-8 shadow-xl sm:p-12">
              <div className="text-center">
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary mb-4">
                  The Complete Plan
                </span>
              </div>
              <ul className="mt-4 flex flex-col gap-5">
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Never Lose Another Job Because the Phone Was Missed</strong> — Every call gets answered instantly, even after hours, so booked jobs don't leak to competitors.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Turn Every Completed Job Into Clean Notes, Next Steps, and Follow-Up Revenue</strong> — Your techs get called after each job so nothing gets forgotten, customer feedback is captured, and future service opportunities are documented.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Book Jobs Without Manual Entry or Office Bottlenecks</strong> — New appointments, reschedules, and cancellations flow directly into your calendar/CRM so your team stops chasing notes and fixing scheduling mistakes.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Automatically Confirm, Remind, and Recover Appointments</strong> — Customers get confirmations, reminders, and reschedule options automatically, reducing no-shows, confusion, and wasted technician time.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Reactivate Old Customers and Fill the Calendar During Slow Seasons</strong> — We run up to 5 revenue campaigns per year to bring past customers back, drive reviews, and create demand when call volume slows down.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">Know Exactly What the AI Booked, Saved, and Recovered</strong> — Quarterly business reviews show calls answered, jobs booked, missed revenue recovered, and missed revenue documented in plain numbers.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    <strong className="text-brand-secondary">See Every Call, Booking, and Customer Interaction</strong> — Full recordings and booking logs give you total visibility, accountability, and proof of what happened on every customer interaction.
                  </span>
                </li>
              </ul>
              <div className="mt-8 rounded-lg bg-amber-50 p-4 text-center">
                <p className="text-sm text-amber-700">
                  90-day initial commitment required. Month-to-month after that with 30 days' notice.
                </p>
              </div>
              <a
                href="/contact"
                className="mt-6 flex w-full items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
              >
                Get Started Today
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SALES PROCESS ========== */}
      <section className="bg-white py-24 sm:py-32 animate-fade-in">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
              How It Works
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
              Three Steps to Freedom
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Getting started is simple. We handle the heavy lifting.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm text-center animate-slide-up animate-delay-100">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-2xl font-bold text-white">
                <PhoneRingIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Industry-Specific Demo
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                We show you exactly how Voice AI handles calls for your
                specific trade — plumbing, HVAC, electrical, pest control,
                or roofing. See it before you commit.
              </p>
            </div>
            <div className="relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm text-center animate-slide-up animate-delay-200">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-2xl font-bold text-white">
                <AIIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Discovery & Scoping
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                We gather data, validate your tech stack, and scope the
                integration. Every detail is mapped before we build
                anything.
              </p>
            </div>
            <div className="relative rounded-xl border border-gray-100 bg-white p-8 shadow-sm text-center animate-slide-up animate-delay-300">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary text-2xl font-bold text-white">
                <RevenueIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Business Case & Onboarding
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                We present your revenue gap estimate, sign the order documents,
                and begin seeing results quickly. Then we keep working until
                you see results.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 90-DAY GUARANTEE ========== */}
      <section className="bg-brand-secondary py-24 sm:py-32 animate-slide-up">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-5xl text-center">
            <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-400">
              Our Promise to You
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
              90-Day Results Guarantee
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-gray-200 sm:text-2xl">
              We guarantee you recover at least our service investment in booked
              service-visit revenue within 90 days of go-live —{" "}
              <span className="font-bold text-brand-primary">
                or we keep working, for free, until you do.
              </span>
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-300">
              If we don&apos;t perform, you don&apos;t pay beyond the Results
              Engagement Period.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-white/5 p-8 backdrop-blur-sm animate-slide-up animate-delay-100">
                <div className="text-5xl font-bold text-brand-primary">90</div>
                <div className="mt-2 text-base font-semibold text-white">
                  Days to Results
                </div>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                  Recover at least our service investment in booked service-visit
                  revenue within 90 days of go-live.
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-white/5 p-8 backdrop-blur-sm animate-slide-up animate-delay-200">
                <div className="text-5xl font-bold text-brand-primary">100%</div>
                <div className="mt-2 text-base font-semibold text-white">
                  Risk Reversal
                </div>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                  If we don&apos;t perform, you don&apos;t pay beyond the Results
                  Engagement Period.
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-white/5 p-8 backdrop-blur-sm animate-slide-up animate-delay-300">
                <div className="text-5xl font-bold text-brand-primary">∞</div>
                <div className="mt-2 text-base font-semibold text-white">
                  Ongoing Commitment
                </div>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                  We keep working, for free, until you recover at least our
                  service investment. That&apos;s how confident we are.
                </p>
              </div>
            </div>
            <div className="mt-10 rounded-lg bg-white/5 border border-gray-700 p-4 inline-block">
              <p className="text-sm text-gray-300">
                90-day initial commitment required. Month-to-month after that with 30 days' notice.
              </p>
            </div>
            <a
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
            >
              Start Your Risk-Free Trial
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

      {/* ========== TESTIMONIAL / MISSION ========== */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
            Our Mission
          </span>
          <blockquote className="mt-6 text-2xl font-medium leading-relaxed text-brand-secondary sm:text-3xl">
            "No one can serve two masters. Either you will hate the one and love
            the other, or you will be devoted to the one and despise the other."
          </blockquote>
          <p className="mt-4 text-base text-gray-500">— Matthew 6:24</p>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-600">
            God uses slavery language on purpose. He knows the human heart. We
            build businesses to serve us — but too often, we end up serving
            them. 624 Voice exists so home services owners can reclaim
            their time, their family, and their purpose — and use their business
            to serve what truly matters.
          </p>
          <a
            href="/about"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
          >
            Read Our Story
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="bg-brand-accent-light py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary sm:text-4xl">
            Ready to Answer Every Call?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            Join the home services companies that never miss a job — and have
            their evenings, weekends, and peace of mind back.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/contact"
              className="rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
            >
              Schedule Your Demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

/* Helper components */

function FeatureCard({
  icon,
  title,
  description,
  trades,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  trades?: string[];
}) {
  return (
    <div className="group rounded-xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-brand-primary/20">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {icon}
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {description}
      </p>
      {trades && trades.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {trades.map((trade) => (
            <span
              key={trade}
              className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary"
            >
              {trade}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}