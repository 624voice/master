import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VoiceDemo } from "~/components/VoiceDemo";
import type { DemoLead } from "~/server/submitDemoLead";
import { submitDemoLead } from "~/server/submitDemoLead";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

function DemoPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteOption, setWebsiteOption] = useState<"has" | "none" | "">("");
  const [website, setWebsite] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<DemoLead | null>(null);

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
          email,
          phone,
          websiteOption,
          website: websiteOption === "has" ? website : undefined,
          smsConsent,
        },
      });
      setLead(result.lead);
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
            AI receptionist right in your browser.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-xl">
          {!lead ? (
            <>
              <h2 className="text-2xl font-bold text-brand-secondary">
                Before we connect you
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Share a few details so we can follow up after your demo call.
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="demo-firstName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      First name
                    </label>
                    <input
                      id="demo-firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="demo-lastName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Last name
                    </label>
                    <input
                      id="demo-lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="demo-businessName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Business name
                  </label>
                  <input
                    id="demo-businessName"
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="demo-email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="demo-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="demo-phone"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Phone
                  </label>
                  <input
                    id="demo-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700">
                    Do you have a website?
                  </legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="radio"
                        name="demo-websiteOption"
                        value="has"
                        checked={websiteOption === "has"}
                        onChange={() => {
                          setWebsiteOption("has");
                          setError(null);
                        }}
                      />
                      Yes
                    </label>
                    {websiteOption === "has" && (
                      <input
                        type="url"
                        placeholder="https://yourcompany.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className={inputClassName}
                        required
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="radio"
                        name="demo-websiteOption"
                        value="none"
                        checked={websiteOption === "none"}
                        onChange={() => {
                          setWebsiteOption("none");
                          setWebsite("");
                          setError(null);
                        }}
                      />
                      I don&apos;t have a website
                    </label>
                  </div>
                </fieldset>
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
            </>
          ) : (
            <VoiceDemo lead={lead} />
          )}
        </div>
      </section>
    </main>
  );
}
