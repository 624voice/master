import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoAgentPanel } from "~/components/DemoAgentPanel";
import { DemoHowToStart } from "~/components/DemoHowToStart";
import { DemoJessicaHeading } from "~/components/DemoJessicaHeading";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "gate" | "form" | "demo" | "limit";

const primaryButtonClassName =
  "w-full rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "block w-full rounded-lg border border-white/25 bg-white/5 px-8 py-3.5 text-center text-base font-semibold text-white transition-all hover:border-brand-primary hover:bg-white/10 no-underline";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      {
        title: "Talk to Jessica — Live AI Receptionist Demo | 624 Voice",
      },
      {
        name: "description",
        content:
          "Have a natural conversation with Jessica in your browser. Live AI demo for home services — FAQs, booking, maintenance plans, and confirmations.",
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
      <section className="bg-brand-secondary px-6 py-8 sm:py-10 lg:min-h-[calc(100dvh-5rem)] lg:py-12">
        <div className="mx-auto grid max-w-7xl items-start gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="order-2 lg:order-1">
            <span className="mb-3 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
              No Pitch. No Fluff.
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Talk to Jessica
            </h1>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-brand-primary sm:text-3xl lg:text-4xl">
              Live AI Demo
            </p>
            <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
              Hear exactly what your callers could experience — 24/7/365, on the
              first ring.
            </p>
            <div className="mt-4">
              <DemoHowToStart variant="hero" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            {view === "gate" && (
              <DemoAgentPanel>
                <DemoHowToStart variant="gate" />

                <div className="mt-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm">
                    <img
                      src="/logo.png"
                      alt="624 Voice"
                      className="h-10 w-10 opacity-90"
                    />
                  </div>

                  <DemoJessicaHeading />

                  <p className="mt-5 text-sm font-medium text-white">
                    Ready? Click below to get started:
                  </p>
                  <button
                    type="button"
                    onClick={() => setView("form")}
                    className={`mt-4 ${primaryButtonClassName}`}
                  >
                    Get Instant Access
                  </button>
                  <p className="mt-3 text-sm text-gray-400">1 call per visitor</p>
                </div>

                <a href="/contact" className={`mt-5 ${secondaryButtonClassName}`}>
                  Want This on Your Phones? →
                </a>
              </DemoAgentPanel>
            )}

            {view === "form" && (
              <DemoAgentPanel>
                <DemoJessicaHeading className="mb-4" />
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  Get instant access
                </h2>
                <p className="mt-2 text-sm text-gray-300">
                  Same details as our contact form — then you&apos;ll connect
                  live with Jessica.
                </p>
                <DemoHowToStart variant="form" />
                <div className="mt-5 rounded-xl bg-white/95 p-4 backdrop-blur-sm sm:p-5">
                  <DemoLeadForm {...formProps} compact />
                </div>
                <button
                  type="button"
                  onClick={() => setView("gate")}
                  className="mt-4 w-full text-center text-sm font-semibold text-gray-300 hover:text-white"
                >
                  ← Back
                </button>
              </DemoAgentPanel>
            )}

            {view === "demo" && lead && (
              <DemoAgentPanel>
                <VoiceDemo
                  lead={lead}
                  autoStart
                  onDemoLimitReached={() => setView("limit")}
                />
              </DemoAgentPanel>
            )}

            {view === "limit" && (
              <DemoAgentPanel>
                <DemoLimitPanel compact onDark />
              </DemoAgentPanel>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <DemoAgentOverview />
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-16 sm:py-24">
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
