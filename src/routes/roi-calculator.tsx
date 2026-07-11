import { createFileRoute } from "@tanstack/react-router";
import { RoiCalculator } from "~/components/RoiCalculator";

export const Route = createFileRoute("/roi-calculator")({
  component: RoiCalculatorPage,
});

function RoiCalculatorPage() {
  return (
    <main className="pt-20 font-[family-name:var(--font-body)]">
      <section className="bg-brand-secondary px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            ROI Calculator
          </span>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-medium tracking-tight text-white sm:text-5xl">
            See Your{" "}
            <span className="text-brand-primary">624 Voice ROI</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Pick your trade, enter your truck count, and get a transparent
            breakdown across three scenarios — in seconds.
          </p>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-16 sm:py-24">
        <RoiCalculator />
      </section>
    </main>
  );
}
