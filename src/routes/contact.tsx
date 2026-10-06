import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketingNavyHero } from "~/components/marketing/MarketingNavyHero";
import { FEATURE_FLAGS } from "~/config/features";
import { PUBLIC_CTA } from "~/content/publicConversion";
import { CONVERSION_ANALYTICS_EVENTS, trackConversionEvent } from "~/lib/analytics/conversionIntent";
import { CONTACT_TRADES, FLEET_SIZE_LABELS, FLEET_SIZE_RANGES } from "~/lib/lead/validateLead";
import { submitContactLead } from "~/server/submitContactLead";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Explore Your Options | 624 Voice" },
      {
        name: "description",
        content:
          "Tell us where leads, follow-up, customer communication, or routine work are slowing the business down. We respond within one business day.",
      },
    ],
  }),
  component: Contact,
});

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

function Contact() {
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
  const [sentWithSms, setSentWithSms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitContactLead({
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
      setSuccess(true);
      trackConversionEvent(CONVERSION_ANALYTICS_EVENTS.contact_form_submitted, {
        source: "contact_form",
      });
      setSentWithSms(smsConsent);
      setFirstName("");
      setLastName("");
      setBusinessName("");
      setTrade("");
      setOtherTrade("");
      setWebsiteOption("");
      setWebsite("");
      setEmail("");
      setPhone("");
      setFleetSize("");
      setMessage("");
      setSmsConsent(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your message. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-20">
      <MarketingNavyHero
        testId="contact-hero"
        headingId="contact-hero-heading"
        eyebrow="Get in touch"
        decorIcons
        supporting="Share a little context about your business and what you want to improve. If you opt in to text messages, we may follow up by SMS; otherwise we respond by email within one business day."
      >
        <span className="text-white">{PUBLIC_CTA.exploreOptions}</span>
      </MarketingNavyHero>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-brand-secondary">
                Send Us a Message
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Share a little about your business and the result you want.
                We&apos;ll respond within one business day.
              </p>
              {success ? (
                <div className="mt-8 rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6">
                  <h3 className="text-lg font-semibold text-brand-secondary">
                    Message sent
                  </h3>
                  <p className="mt-2 text-sm text-brand-secondary">
                    Thanks — we received your message and will get back to you
                    within one business day.
                    {sentWithSms
                      ? " Watch for a text from 624 Voice about next steps."
                      : " We'll follow up using the email address you provided."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(false);
                      setSentWithSms(false);
                    }}
                    className="mt-4 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="firstName"
                        className="block text-sm font-medium text-gray-700"
                      >
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClassName}
                        placeholder="John"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lastName"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputClassName}
                        placeholder="Doe"
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="businessName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={inputClassName}
                      placeholder="Your Company LLC"
                      autoComplete="organization"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="trade"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Trade
                    </label>
                    <select
                      id="trade"
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
                        htmlFor="otherTrade"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Your trade
                      </label>
                      <input
                        type="text"
                        id="otherTrade"
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
                      Website <span className="font-normal text-gray-500">(optional)</span>
                    </legend>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="websiteOption"
                        value="has"
                        checked={websiteOption === "has"}
                        onChange={() => setWebsiteOption("has")}
                      />
                      I have a website
                    </label>
                    {websiteOption === "has" && (
                      <input
                        type="text"
                        id="website"
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
                        name="websiteOption"
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
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClassName}
                      placeholder="john@yourcompany.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClassName}
                      placeholder="(555) 123-4567"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fleetSize"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Fleet Size (approx. trucks){" "}
                      <span className="font-normal text-gray-500">(optional)</span>
                    </label>
                    <select
                      id="fleetSize"
                      value={fleetSize}
                      onChange={(e) => setFleetSize(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    >
                      <option value="">Select fleet size...</option>
                      {FLEET_SIZE_RANGES.map((range) => (
                        <option key={range} value={range}>
                          {FLEET_SIZE_LABELS[range]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-gray-700"
                    >
                      What can we help with?
                    </label>
                    <textarea
                      id="message"
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
                      Optional: Text me about my inquiry or next steps. Message and data rates may apply. Reply STOP to opt out.
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
                    {loading ? "Sending…" : PUBLIC_CTA.exploreOptions}
                  </button>
                </form>
              )}
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold text-brand-secondary">
                  Other Ways to Reach Us
                </h2>
                <div className="mt-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10">
                      <svg
                        className="h-6 w-6 text-brand-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-brand-secondary">
                        Email
                      </h3>
                      <a
                        href="mailto:info@624voice.com"
                        className="mt-1 text-sm text-gray-600 hover:text-brand-primary"
                      >
                        info@624voice.com
                      </a>
                    </div>
                  </div>
                </div>

                {FEATURE_FLAGS.SHOW_VOICE_AI_GUARANTEE ? (
                  <div className="mt-12 rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6 sm:p-8">
                    <h3 className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
                      90-Day{" "}
                      <span className="text-brand-primary">Results Guarantee</span>
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-brand-secondary">
                      We guarantee you recover at least our service investment in
                      booked service-visit revenue within 90 days of go-live —{" "}
                      <span className="font-semibold text-brand-primary">
                        or we keep working, for free, until you do.
                      </span>
                    </p>
                  </div>
                ) : null}
                <p className="mt-8 rounded-lg border border-brand-primary/20 bg-brand-primary-light/40 px-4 py-3 text-sm text-gray-700">
                  Ready to choose a time?{" "}
                  <a
                    href={PUBLIC_CTA.bookHref}
                    className="font-semibold text-brand-primary hover:text-brand-primary-dark"
                  >
                    {PUBLIC_CTA.scheduleConsultation}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Want a Directional Read First?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Take the free {PUBLIC_CTA.freeRevenueAssessment.toLowerCase()} to
            see where leads, follow-up, and visibility may be costing you
            revenue.
          </p>
          <a
            href={PUBLIC_CTA.assessmentHref}
            className="mt-8 inline-flex rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
          >
            {PUBLIC_CTA.estimateLostRevenue}
          </a>
        </div>
      </section>
    </main>
  );
}
