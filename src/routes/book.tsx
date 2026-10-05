import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { GoogleCalendarEmbed } from "~/components/GoogleCalendarEmbed";
import {
  CONVERSION_ANALYTICS_EVENTS,
  trackConversionEvent,
} from "~/lib/analytics/conversionIntent";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Schedule Your Consultation | 624 Voice" },
      {
        name: "description",
        content:
          "Pick a consultation time after your assessment, ROI report, or qualification through contact.",
      },
    ],
  }),
  component: BookMeeting,
});

function BookMeeting() {
  useEffect(() => {
    trackConversionEvent(CONVERSION_ANALYTICS_EVENTS.booking_page_reached, {
      source: "book_route_mount",
    });
  }, []);

  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Schedule a Call
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-white">Book Your </span>
            <span className="text-brand-primary">AI Growth Systems</span>
            <span className="text-white"> Consultation</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            About 30 minutes. Pick a time that works for you. We&apos;ll discuss
            the result you want, where opportunities are slowing down, and the
            most sensible next step for your business.
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
