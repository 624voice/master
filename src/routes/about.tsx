import { createFileRoute } from "@tanstack/react-router";
import {
  AIIcon,
  VoiceWaveIcon,
  PhoneRingIcon,
  CalendarIcon,
  RevenueIcon,
  StarIcon,
} from "~/components/icons";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <main className="pt-20">
      {/* HERO */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Our Story
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Built to Help You Serve
            <br />
            <span className="text-brand-primary">What Matters Most</span>
          </h1>
        </div>
      </section>

      {/* THE VERSE */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-gray-100 bg-brand-accent-light p-12">
            <p className="text-2xl font-medium italic leading-relaxed text-brand-secondary sm:text-3xl">
              "No one can serve two masters. Either you will hate the one and
              love the other, or you will be devoted to the one and despise the
              other. You cannot serve both God and money."
            </p>
            <p className="mt-6 text-base text-gray-500">— Matthew 6:24 (NIV)</p>
          </div>
        </div>
      </section>

      {/* THE MEANING */}
      <section className="bg-brand-accent-light px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Why "624"?
          </h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-gray-700">
            <p>
              The number in our name comes from Matthew 6:24 — a verse that
              uses startling language on purpose. The original Greek word for
              "serve" in this passage is <em>douleuō</em>, which literally means
              "to be a slave to."
            </p>
            <p>
              Jesus isn't being polite here. He's saying: you will be a slave to
              something. The question is not{" "}
              <em>if you will serve a master</em> — it's{" "}
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
              around. When your business runs on its own, you're free to serve
              what matters most: your family, your faith, and your purpose.
            </p>
          </div>
        </div>
      </section>

      {/* THE MISSION */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Our Mission
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Every home services owner deserves a business that works for them,
            not the other way around. We combine Voice AI, smart automation, and
            proven revenue systems to make that happen.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Reclaim Your Time
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Never answer another business call after hours. Never miss a
                family dinner because the phone is ringing. Your AI handles it
                all.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <RevenueIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Never Miss Revenue
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Every call answered, every job booked, every opportunity
                captured — 24/7/365. Your business grows while you sleep.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <StarIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Serve With Purpose
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                When your business runs without you, you're free to serve your
                family, your church, and your community the way you were meant
                to.
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <AIIcon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-secondary">
                Build Something That Lasts
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                A systemized, automated business has value beyond you. Build an
                asset, not a job — and create a legacy for your family.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-secondary px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ready to Stop Serving Your Business?
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Let's talk about what freedom looks like for you.
          </p>
          <a
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
          >
            Start the Conversation
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