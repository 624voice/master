import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentPanel } from "~/components/DemoAgentPanel";
import { DemoHowToStart } from "~/components/DemoHowToStart";
import { DemoJessicaHeading, JessicaCapabilities } from "~/components/DemoJessicaHeading";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "gate" | "form" | "demo" | "limit";

const primaryButtonClassName =
  "w-full rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/30";

const secondaryButtonClassName =
  "block w-full rounded-lg border border-white/25 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white transition-all hover:border-brand-primary hover:bg-white/10 no-underline";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      {
        title: "Talk to Jessica — Live AI Receptionist Demo | 624 Voice",
      },
      {
        name: "description",
        content:
          "Have a natural conversation with Jessica in your browser. Live AI demo for home services.",
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
      <section className="flex min-h-[calc(100dvh-5rem)] flex-col bg-brand-secondary px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="text-center lg:text-left">
            <span className="mb-2 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 sm:text-sm">
              No Pitch. No Fluff.
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Talk to Jessica
            </h1>
            <p className="mt-1 text-lg font-extrabold tracking-tight text-brand-primary sm:text-xl lg:text-2xl">
              Live AI Demo
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-300 sm:text-base">
              Hear exactly what your callers could experience — 24/7/365, on the
              first ring.
            </p>
            <DemoHowToStart variant="hero" />
          </div>

          <div>
            {view === "gate" && (
              <DemoAgentPanel showHero>
                <div className="relative z-10 text-center">
                  <DemoJessicaHeading />
                  <JessicaCapabilities className="mx-auto mt-3 max-w-sm text-sm text-gray-300" />
                  <button
                    type="button"
                    onClick={() => setView("form")}
                    className={`mt-5 ${primaryButtonClassName}`}
                  >
                    Talk to Jessica
                  </button>
                  <p className="mt-2 text-xs text-gray-400">1 call per visitor</p>
                  <a href="/contact" className={`mt-4 ${secondaryButtonClassName}`}>
                    Want This on Your Phones? →
                  </a>
                </div>
              </DemoAgentPanel>
            )}

            {view === "form" && (
              <DemoAgentPanel showHero>
                <DemoJessicaHeading className="mb-3" />
                <DemoHowToStart variant="form" />
                <div className="mt-3 rounded-xl bg-white/95 p-3 backdrop-blur-sm sm:p-4">
                  <DemoLeadForm {...formProps} />
                </div>
                <button
                  type="button"
                  onClick={() => setView("gate")}
                  className="mt-3 w-full text-center text-xs font-semibold text-gray-300 hover:text-white"
                >
                  ← Back
                </button>
              </DemoAgentPanel>
            )}

            {view === "demo" && lead && (
              <DemoAgentPanel showHero>
                <DemoHowToStart variant="demo" />
                <VoiceDemo
                  lead={lead}
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
    </main>
  );
}
