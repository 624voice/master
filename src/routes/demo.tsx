import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { DemoBackground } from "~/components/demo/DemoBackground";
import { DemoBrowserCard } from "~/components/demo/DemoBrowserCard";
import { DemoHeroLeft } from "~/components/demo/DemoHeroLeft";
import { DemoJessicaInterface } from "~/components/demo/DemoJessicaInterface";
import { useVoiceDemo } from "~/hooks/useVoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type PageView = "gate" | "form" | "demo" | "limit";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      {
        title: "Talk to Jessica — Live AI Receptionist Demo | 624 Voice",
      },
      {
        name: "description",
        content:
          "Experience what your customers hear when they call your business. Talk to Jessica, our AI voice agent, live in your browser.",
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
  const [pageView, setPageView] = useState<PageView>("gate");

  const voiceDemo = useVoiceDemo({
    lead,
    onDemoLimitReached: () => setPageView("limit"),
  });

  const handleStartDemo = useCallback(() => {
    if (pageView === "limit" || voiceDemo.isBusy) return;

    if (pageView === "gate") {
      setPageView("form");
      return;
    }

    if (pageView === "demo" && lead) {
      void voiceDemo.startCall();
    }
  }, [lead, pageView, voiceDemo.isBusy, voiceDemo.startCall]);

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
        setPageView("limit");
        return;
      }

      setLead(result.lead);
      voiceDemo.reset();
      setPageView("demo");
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

  const startDisabled =
    voiceDemo.isBusy || pageView === "limit" || pageView === "form";

  const cardCallState =
    pageView === "gate" ? ("idle" as const) : voiceDemo.callState;

  const cardStatusText =
    pageView === "gate"
      ? "Tap to talk with Jessica"
      : voiceDemo.statusText;

  return (
    <main className="bg-[#152233]">
      <section className="relative min-h-[calc(100dvh-5.5rem)] overflow-x-hidden px-5 py-4 sm:px-8 lg:px-10 lg:py-5">
        <DemoBackground />

        <div className="relative mx-auto flex min-h-[calc(100dvh-6rem)] max-w-[1450px] flex-col justify-center overflow-visible">
          <div className="grid items-center gap-8 overflow-visible lg:grid-cols-[44%_56%] lg:gap-12 xl:gap-16">
            <DemoHeroLeft
              onStartDemo={handleStartDemo}
              startDisabled={startDisabled}
              showCta={pageView === "gate" || pageView === "demo"}
            />

            <div className="flex justify-center overflow-visible lg:justify-end">
              {pageView === "form" ? (
                <DemoBrowserCard>
                  <h2 className="text-center text-xl font-bold text-[#18222f]">
                    Before you start
                  </h2>
                  <p className="mt-2 text-center text-sm text-[#94A3B8]">
                    A few quick details, then you&apos;ll connect live with Jessica.
                  </p>
                  <div className="mt-5">
                    <DemoLeadForm {...formProps} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPageView("gate")}
                    className="mt-4 w-full text-center text-sm font-medium text-[#94A3B8] hover:text-[#10b981]"
                  >
                    ← Back
                  </button>
                </DemoBrowserCard>
              ) : pageView === "limit" ? (
                <DemoBrowserCard>
                  <DemoLimitPanel compact />
                </DemoBrowserCard>
              ) : (
                <DemoBrowserCard>
                  <DemoJessicaInterface
                    callState={cardCallState}
                    statusText={cardStatusText}
                    onMicClick={handleStartDemo}
                    onEndCall={() => void voiceDemo.stopCall()}
                    onTryAgain={voiceDemo.reset}
                    onBookMeeting={() => setPageView("limit")}
                    micDisabled={startDisabled}
                    elapsed={voiceDemo.elapsed}
                    maxSeconds={voiceDemo.maxSeconds}
                  />
                </DemoBrowserCard>
              )}
            </div>
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
