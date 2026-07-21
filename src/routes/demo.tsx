import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoLeadForm } from "~/components/DemoLeadForm";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "gate" | "form" | "demo" | "limit";

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
      <section className="min-h-[calc(100dvh-5rem)] bg-[#18222f] px-6 py-16 font-[family-name:var(--font-body)] sm:py-20">
        <div className="mx-auto max-w-[960px] overflow-hidden rounded-xl border border-brand-primary/10 bg-[#18222f]">
          <div className="demo-grid grid lg:grid-cols-2">
            <div className="p-9 sm:p-11">
              <DemoAgentOverview />
            </div>

            <div className="flex flex-col justify-center border-t border-slate-400/10 p-7 sm:p-9 lg:border-t-0 lg:border-l">
              {view === "gate" && (
                <div className="flex flex-col items-center gap-5">
                  <div className="text-center">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary">
                      Hear the difference yourself
                    </p>
                    <p className="text-[13px] leading-relaxed text-slate-400">
                      Talk to her. See exactly what your callers could experience
                      24/7/365.
                    </p>
                  </div>

                  <div className="w-full rounded-xl border border-slate-400/15 bg-white/[0.03] p-8 text-center">
                    <div className="mx-auto mb-3.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-brand-primary/55 bg-brand-primary/10">
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
                    <p className="mb-1 text-base font-bold text-white">
                      Talk to Jessica
                    </p>
                    <p className="mb-5 text-xs text-slate-400">
                      Live AI Demo · 624 Voice
                    </p>
                    <button
                      type="button"
                      onClick={() => setView("form")}
                      className="mb-2.5 w-full rounded-lg bg-brand-primary px-6 py-3.5 text-sm font-bold text-[#18222f] transition-colors hover:bg-brand-primary-dark"
                    >
                      Get Instant Access
                    </button>
                    <p className="text-[11px] text-slate-500">
                      1 call per visitor
                    </p>
                  </div>

                  <a
                    href="/contact"
                    className="block w-full rounded-md border border-brand-primary bg-[#1e3a2f] px-5 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-brand-primary no-underline transition-colors hover:bg-[#1e3a2f]/80"
                  >
                    Want This on Your Phones? →
                  </a>
                </div>
              )}

              {view === "form" && (
                <div>
                  <h2 className="mb-1 text-lg font-bold text-white">
                    Get instant access
                  </h2>
                  <p className="mb-5 text-xs text-slate-400">
                    Same details as our contact form — then you&apos;ll connect
                    live with Jessica.
                  </p>
                  <DemoLeadForm {...formProps} />
                  <button
                    type="button"
                    onClick={() => setView("gate")}
                    className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-300"
                  >
                    ← Back
                  </button>
                </div>
              )}

              {view === "demo" && lead && (
                <VoiceDemo
                  lead={lead}
                  autoStart
                  onDemoLimitReached={() => setView("limit")}
                />
              )}

              {view === "limit" && <DemoLimitPanel compact />}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
