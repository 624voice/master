import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoHowToStart } from "~/components/DemoHowToStart";
import { JessicaCapabilities } from "~/components/DemoJessicaHeading";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { DemoPageBackground } from "~/components/DemoPageBackground";
import { DemoPreviewCard } from "~/components/DemoPreviewCard";
import { JessicaPreview } from "~/components/JessicaPreview";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "gate" | "form" | "demo" | "limit";

const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-brand-primary hover:bg-white/10 no-underline";

function MicIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function ShieldIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

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
  const [websiteOption, setWebsiteOption] = useState<"has" | "none" | "">("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
          websiteOption,
          website: websiteOption === "has" ? website : undefined,
          email,
          phone,
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
    websiteOption,
    setWebsiteOption,
    website,
    setWebsite,
    email,
    setEmail,
    phone,
    setPhone,
    smsConsent,
    setSmsConsent,
    loading,
    error,
    onSubmit: handleSubmit,
    onClearError: () => setError(null),
  };

  return (
    <main className="pt-20">
      <section className="relative flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden bg-brand-secondary px-4 py-4 sm:px-6 sm:py-6">
        <DemoPageBackground />

        <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="text-center lg:text-left">
            <img
              src="/logo.png"
              alt="624 Voice"
              className="mx-auto mb-4 h-10 w-10 lg:mx-0"
            />
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Talk to{" "}
              <span className="text-brand-primary">Jessica</span>
            </h1>
            <p className="mt-2 text-base font-semibold text-white sm:text-lg">
              Click. Talk. Get Things Done.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-300 sm:text-base">
              Hear exactly what your callers could experience — 24/7/365, on the
              first ring.
            </p>
            <JessicaCapabilities className="mt-3 text-sm text-gray-300 sm:text-base" />

            {view === "gate" && (
              <div className="mt-6 flex flex-col items-center lg:items-start">
                <button
                  type="button"
                  onClick={() => setView("form")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/40"
                >
                  <MicIcon />
                  Start Demo
                </button>
                <p className="mt-3 inline-flex items-center gap-2 text-xs text-gray-400 sm:text-sm">
                  <ShieldIcon />
                  Secure. Private. In-Browser.
                </p>
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400 sm:text-sm">
              1 call per visitor
            </p>
            <a href="/contact" className={`mt-3 ${secondaryButtonClassName}`}>
              Want This on Your Phones? →
            </a>
          </div>

          <div>
            {view === "gate" && (
              <DemoPreviewCard>
                <JessicaPreview />
              </DemoPreviewCard>
            )}

            {view === "form" && (
              <DemoPreviewCard>
                <h2 className="text-center text-lg font-bold text-brand-secondary sm:text-xl">
                  Before you start
                </h2>
                <DemoHowToStart variant="form" />
                <div className="mt-4">
                  <DemoLeadForm {...formProps} />
                </div>
                <button
                  type="button"
                  onClick={() => setView("gate")}
                  className="mt-4 w-full text-center text-xs font-semibold text-gray-500 hover:text-brand-primary"
                >
                  ← Back
                </button>
              </DemoPreviewCard>
            )}

            {view === "demo" && lead && (
              <DemoPreviewCard>
                <DemoHowToStart variant="demo" />
                <VoiceDemo
                  lead={lead}
                  onDemoLimitReached={() => setView("limit")}
                />
              </DemoPreviewCard>
            )}

            {view === "limit" && (
              <DemoPreviewCard>
                <DemoLimitPanel compact />
              </DemoPreviewCard>
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
