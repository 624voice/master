import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/what-we-do")({
  component: WhatWeDoPage,
});

function WhatWeDoPage() {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            What We Do
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            AI Growth Systems for{" "}
            <span className="text-brand-primary">Home Services</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Six connected dimensions help you get found, respond, convert, retain,
            reduce manual work, and measure what is working.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm text-amber-700">
            Full Phase2Final Section 4 copy pending owner document availability.
            Lifecycle diagram asset flagged N.
          </p>
        </div>
      </section>
    </main>
  );
}
