import { GoogleCalendarEmbed } from "~/components/GoogleCalendarEmbed";

export function DemoLimitPanel() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-xl font-bold text-brand-secondary">
          One demo call per visitor
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          You&apos;ve already experienced our live AI demo. To keep things fair
          for everyone, each email or phone number gets one web call with
          Jessica.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Ready for the next step? Book a meeting and we&apos;ll walk through
          how 624 Voice fits your business.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <GoogleCalendarEmbed className="min-h-[600px] w-full" />
      </div>

      <p className="text-center text-sm text-gray-500">
        Prefer email?{" "}
        <a
          href="mailto:info@624voice.com"
          className="font-medium text-brand-primary hover:text-brand-primary-dark"
        >
          info@624voice.com
        </a>
      </p>
    </div>
  );
}
