import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "gate" | "form" | "demo" | "limit";

const primaryButtonClassName =
  "w-full rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "block w-full rounded-lg border border-gray-300 px-8 py-3.5 text-center text-base font-semibold text-brand-secondary transition-all hover:border-brand-primary hover:text-brand-primary no-underline";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      {
        title: "Talk to Jessica — Live AI Receptionist Demo | 624 Voice",
      },
      {
        name: "description",
        content:
          "Hear what your phones could sound like 24/7/365. Talk to Jessica, our live AI receptionist demo built for home services businesses.",
      },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [trade, setTrade] = useState("");
  const [otherTrade, setOtherTrade] = useState("");
  const [websiteOption, setWebsiteOption] = useState<"has" | "none" | "">("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fleetSize, setFleetSize] = useState("");
  const [message, setMessage] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<DemoLead | null>(null);
  const [view, setView] = useState<DemoView>("gate");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await submitDemoLead({
        data: {
          firstName,
          lastName,
          businessName,
          trade,
          otherTrade: trade === "Other" ? otherTrade : undefined,
          websiteOption,
          website: websiteOption === "has" ? website : undefined,
          email,
          phone,
          fleetSize,
          message,
          smsConsent,
        },
      });
      if (result.demoAlreadyUsed) {
        setView("limit");
        return;
      }

      setLead(result.lead);
      setView("demo");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your information. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formProps = {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    businessName,
    setBusinessName,
    trade,
    setTrade,
    otherTrade,
    setOtherTrade,
    websiteOption,
    setWebsiteOption,
    website,
    setWebsite,
    email,
    setEmail,
    phone,
    setPhone,
    fleetSize,
    setFleetSize,
    message,
    setMessage,
    smsConsent,
    setSmsConsent,
    loading,
    error,
    onSubmit: handleSubmit,
    onClearError: () => setError(null),
  };

  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            No Pitch. No Fluff.
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Talk to Jessica —{" "}
            <span className="text-brand-primary">Live AI Demo</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            What&apos;s happening to the calls that come in while you&apos;re on
            a job and after hours? Hear exactly what your callers could
            experience — 24/7/365, on the first ring.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <DemoAgentOverview />

            <div className="flex flex-col justify-center">
              {view === "gate" && (
                <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                  <div className="text-center">
                    <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
                      Hear the difference yourself
                    </span>
                    <p className="text-sm leading-relaxed text-gray-600">
                      Talk to her. See exactly what your callers could
                      experience 24/7/365.
                    </p>
                  </div>

                  <div className="mt-6 rounded-xl border border-gray-100 bg-brand-accent-light/40 p-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
                      <svg
                        className="h-7 w-7 text-brand-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-brand-secondary">
                      Talk to Jessica
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Live AI Demo · 624 Voice
                    </p>
                    <button
                      type="button"
                      onClick={() => setView("form")}
                      className={`mt-6 ${primaryButtonClassName}`}
                    >
                      Get Instant Access
                    </button>
                    <p className="mt-3 text-sm text-gray-500">
                      1 call per visitor
                    </p>
                  </div>

                  <a href="/contact" className={`mt-6 ${secondaryButtonClassName}`}>
                    Want This on Your Phones? →
                  </a>
                </div>
              )}

              {view === "form" && (
                <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                  <h2 className="text-2xl font-bold text-brand-secondary">
                    Get instant access
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Same details as our contact form — then you&apos;ll connect
                    live with Jessica.
                  </p>
                  <div className="mt-8">
                    <DemoLeadForm {...formProps} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("gate")}
                    className="mt-4 w-full text-center text-sm font-semibold text-gray-500 hover:text-brand-primary"
                  >
                    ← Back
                  </button>
                </div>
              )}

              {view === "demo" && lead && (
                <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                  <VoiceDemo
                    lead={lead}
                    autoStart
                    onDemoLimitReached={() => setView("limit")}
                  />
                </div>
              )}

              {view === "limit" && (
                <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                  <DemoLimitPanel compact />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee + CTA */}
      <section className="bg-brand-accent-light px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6 sm:p-8">
            <h3 className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
              90-Day{" "}
              <span className="text-brand-primary">Results Guarantee</span>
            </h3>
            <p className="mt-4 text-base leading-relaxed text-brand-secondary">
              We guarantee you recover at least our service investment in booked
              service-visit revenue within 90 days of go-live —{" "}
              <span className="font-semibold text-brand-primary">
                or we keep working, for free, until you do.
              </span>
            </p>
          </div>

          <div className="mt-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
              Ready to Answer Every Call?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Book a meeting and we&apos;ll walk through how 624 Voice fits your
              business.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="/contact"
                className="inline-flex rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark"
              >
                Schedule Your Demo
              </a>
              <a
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
              >
                Back to Home
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
          </div>
        </div>
      </section>
    </main>
  );
}
