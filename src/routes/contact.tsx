import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  component: Contact,
});

function Contact() {
  return (
    <main className="pt-20">
      {/* HERO */}
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Get Started
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to Answer{" "}
            <span className="text-brand-primary">Every Call?</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Let's talk about how 624 Voice can help your business run
            itself — so you can focus on what matters most.
          </p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact form */}
            <div>
              <h2 className="text-2xl font-bold text-brand-secondary">
                Send Us a Message
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Fill out the form below and we'll get back to you within 24
                hours to schedule your personalized demo.
              </p>
              <form
                className="mt-8 space-y-6"
                onSubmit={(e) => e.preventDefault()}
              >
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
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="John"
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
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="Doe"
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
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Your Company LLC"
                  />
                </div>
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
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="john@yourcompany.com"
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
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label
                    htmlFor="fleetSize"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Fleet Size (approx. trucks)
                  </label>
                  <select
                    id="fleetSize"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
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
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700"
                  >
                    What can we help with?
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Tell us about your business and what you're looking for..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark"
                >
                  Send Message
                </button>
              </form>
            </div>

            {/* Contact info & CTA */}
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
                  <p className="mt-3 text-base leading-relaxed text-brand-secondary">
                    If we don&apos;t perform, you don&apos;t pay beyond the{" "}
                    <span className="font-medium">Results Engagement Period</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-brand-accent-light px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-brand-secondary">
            Not Ready Yet? No Problem.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Bookmark us. When you're ready to stop missing calls and start
            living your life, we'll be here.
          </p>
          <a
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
          >
            Back to Home
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
      </section>
    </main>
  );
}