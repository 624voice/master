import { createFileRoute } from "@tanstack/react-router";
import { GoogleCalendarEmbed } from "~/components/GoogleCalendarEmbed";

export const Route = createFileRoute("/book")({
  component: BookMeeting,
});

function BookMeeting() {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Schedule a Call
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Book a Meeting
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Pick a time that works for you. We&apos;ll walk through how 624 Voice
            can help your business answer every call and recover missed revenue.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <GoogleCalendarEmbed className="min-h-[600px] w-full" />
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-sm text-gray-500">
          Prefer email? Reach us at{" "}
          <a
            href="mailto:info@624voice.com"
            className="font-medium text-brand-primary hover:text-brand-primary-dark"
          >
            info@624voice.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
