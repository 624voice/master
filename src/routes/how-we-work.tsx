import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/how-we-work")({
  component: HowWeWorkPage,
});

function HowWeWorkPage() {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            How We Work
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            A Clear Path from{" "}
            <span className="text-brand-primary">Assessment to Results</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            We start with your business context, identify priority gaps, and
            implement systems that fit how your team already works.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm text-amber-700">
            Full Phase2Final Section 5 copy pending owner document availability.
          </p>
        </div>
      </section>
    </main>
  );
}
