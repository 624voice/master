import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DemoAgentOverview } from "~/components/DemoAgentOverview";
import { DemoLimitPanel } from "~/components/DemoLimitPanel";
import { VoiceDemo } from "~/components/VoiceDemo";
import { CONTACT_TRADES } from "~/lib/lead/validateLead";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

type DemoView = "form" | "demo" | "limit";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

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
  const [view, setView] = useState<DemoView>("form");

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

  const containerClass =
    view === "limit"
      ? "mx-auto max-w-4xl"
      : view === "demo"
        ? "mx-auto max-w-xl"
        : "mx-auto max-w-5xl";

  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Live Demo
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Talk to{" "}
            <span className="text-brand-primary">Jessica</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Experience 624 Voice firsthand — have a real conversation with our
            AI receptionist right in your browser. No phone call required.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className={containerClass}>
          {view === "form" ? (
            <div className="grid gap-12 lg:grid-cols-2">
              <DemoAgentOverview />
              <div>
                <h2 className="text-2xl font-bold text-brand-secondary">
                  Before we connect you
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Same details as our contact form — so we can follow up after
                  your demo and tailor the conversation to your business.
                </p>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="demo-firstName"
                        className="block text-sm font-medium text-gray-700"
                      >
                        First Name
                      </label>
                      <input
                        id="demo-firstName"
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClassName}
                        placeholder="John"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="demo-lastName"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Last Name
                      </label>
                      <input
                        id="demo-lastName"
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputClassName}
                        placeholder="Doe"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="demo-businessName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Business Name
                    </label>
                    <input
                      id="demo-businessName"
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={inputClassName}
                      placeholder="Your Company LLC"
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-trade"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Trade
                    </label>
                    <select
                      id="demo-trade"
                      value={trade}
                      onChange={(e) => {
                        setTrade(e.target.value);
                        if (e.target.value !== "Other") {
                          setOtherTrade("");
                        }
                      }}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      required
                    >
                      <option value="">Select your trade...</option>
                      {CONTACT_TRADES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {trade === "Other" && (
                    <div>
                      <label
                        htmlFor="demo-otherTrade"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Your trade
                      </label>
                      <input
                        id="demo-otherTrade"
                        type="text"
                        value={otherTrade}
                        onChange={(e) => setOtherTrade(e.target.value)}
                        className={inputClassName}
                        placeholder="Enter your trade"
                        required
                      />
                    </div>
                  )}
                  <fieldset className="space-y-3">
                    <legend className="block text-sm font-medium text-gray-700">
                      What is your website?
                    </legend>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="demo-websiteOption"
                        value="has"
                        checked={websiteOption === "has"}
                        onChange={() => setWebsiteOption("has")}
                        required
                      />
                      I have a website
                    </label>
                    {websiteOption === "has" && (
                      <input
                        type="text"
                        id="demo-website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className={inputClassName}
                        placeholder="https://yourcompany.com"
                        autoComplete="url"
                        required
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="demo-websiteOption"
                        value="none"
                        checked={websiteOption === "none"}
                        onChange={() => {
                          setWebsiteOption("none");
                          setWebsite("");
                        }}
                      />
                      I don&apos;t have a website
                    </label>
                  </fieldset>
                  <div>
                    <label
                      htmlFor="demo-email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email Address
                    </label>
                    <input
                      id="demo-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClassName}
                      placeholder="john@yourcompany.com"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Phone Number
                    </label>
                    <input
                      id="demo-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClassName}
                      placeholder="(555) 123-4567"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-fleetSize"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Fleet Size (approx. trucks)
                    </label>
                    <select
                      id="demo-fleetSize"
                      value={fleetSize}
                      onChange={(e) => setFleetSize(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      required
                    >
                      <option value="">Select fleet size...</option>
                      <option value="1-2">1–2 Trucks</option>
                      <option value="3-7">3–7 Trucks</option>
                      <option value="7-20">7–20 Trucks</option>
                      <option value="20-50">20–50 Trucks</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="demo-message"
                      className="block text-sm font-medium text-gray-700"
                    >
                      What can we help with?
                    </label>
                    <textarea
                      id="demo-message"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={inputClassName}
                      placeholder="Tell us about your business and what you're looking for..."
                      required
                    />
                  </div>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={(e) => {
                        setSmsConsent(e.target.checked);
                        setError(null);
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20"
                    />
                    <span className="text-sm text-gray-600">
                      I agree to receive text messages from 624 Voice about my
                      inquiry. Message and data rates may apply. Reply STOP to
                      opt out.
                    </span>
                  </label>
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Submitting…" : "Continue to demo"}
                  </button>
                </form>
              </div>
            </div>
          ) : view === "demo" && lead ? (
            <VoiceDemo
              lead={lead}
              onDemoLimitReached={() => setView("limit")}
            />
          ) : (
            <DemoLimitPanel />
          )}
        </div>
      </section>
    </main>
  );
}
