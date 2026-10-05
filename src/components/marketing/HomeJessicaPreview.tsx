import { DemoWaveform } from "~/components/demo/DemoWaveform";

const OUTCOMES = [
  "Answer every call immediately",
  "Move qualified callers toward booking",
  "Support English and Spanish naturally",
] as const;

export function HomeJessicaPreview() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
      <div className="flex flex-col items-center lg:items-start">
        <div className="relative aspect-square w-[min(100%,280px)]">
          <div
            className="absolute inset-0 rounded-full bg-brand-primary/15 blur-md motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <img
            src="/jessica-avatar.png"
            alt="Jessica, AI voice agent"
            className="relative h-full w-full object-contain drop-shadow-lg"
          />
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-secondary shadow-md">
            <span
              className="h-2.5 w-2.5 rounded-full bg-brand-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Online now
          </span>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500">
          Jessica is an AI voice agent, not a human employee.
        </p>
      </div>

      <div className="text-center lg:text-left">
        <DemoWaveform callState="idle" className="mx-auto max-w-md lg:mx-0" />
        <ul className="mt-6 space-y-3 text-left text-base text-gray-700">
          {OUTCOMES.map((line) => (
            <li key={line} className="flex gap-3">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-primary"
                aria-hidden="true"
              />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-gray-600">
          Don&apos;t just read about it. Talk with the agent after a short access
          form.
        </p>
        <a
          href="/demo"
          data-analytics-intent="home_demo_cta"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark"
        >
          Talk With Our AI Voice Agent
        </a>
        <p className="mt-3 text-sm text-gray-500">
          Complete the short access form, then talk with Jessica in your browser.
        </p>
        <p className="mt-1 text-xs text-gray-400 sm:hidden">
          Short access form required.
        </p>
      </div>
    </div>
  );
}
