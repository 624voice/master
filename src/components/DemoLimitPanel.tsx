import { GoogleCalendarEmbed } from "~/components/GoogleCalendarEmbed";

type DemoLimitPanelProps = {
  compact?: boolean;
  onDark?: boolean;
};

export function DemoLimitPanel({
  compact = false,
  onDark = false,
}: DemoLimitPanelProps) {
  if (compact) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div
          className={`rounded-xl p-6 text-center ${
            onDark
              ? "border border-amber-400/30 bg-amber-500/10"
              : "border border-amber-200 bg-amber-50"
          }`}
        >
          <h2
            className={`text-xl font-bold ${
              onDark ? "text-white" : "text-brand-secondary"
            }`}
          >
            One demo call per visitor
          </h2>
          <p
            className={`mt-3 text-sm leading-relaxed ${
              onDark ? "text-gray-200" : "text-gray-700"
            }`}
          >
            You&apos;ve already talked with Jessica. Ready to see this on your
            phones? Book a meeting below.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <GoogleCalendarEmbed className="min-h-[420px] w-full" />
        </div>
        <a
          href="/contact"
          className={
            onDark
              ? "block w-full rounded-lg border border-white/25 bg-white/5 px-8 py-3.5 text-center text-base font-semibold text-white transition-all hover:border-brand-primary hover:bg-white/10 no-underline"
              : "block w-full rounded-lg border border-gray-300 px-8 py-3.5 text-center text-base font-semibold text-brand-secondary transition-all hover:border-brand-primary hover:text-brand-primary no-underline"
          }
        >
          Want This on Your Phones? →
        </a>
      </div>
    );
  }

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
