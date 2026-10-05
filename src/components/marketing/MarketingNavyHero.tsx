import type { ReactNode } from "react";

type MarketingNavyHeroProps = {
  eyebrow: string;
  children: ReactNode;
  supporting: ReactNode;
  meta?: ReactNode;
  testId?: string;
  headingId?: string;
};

/** Shared navy hero: green accent on headline span, white body copy. */
export function MarketingNavyHero({
  eyebrow,
  children,
  supporting,
  meta,
  testId,
  headingId = "marketing-navy-hero-heading",
}: MarketingNavyHeroProps) {
  return (
    <section
      className="overflow-x-hidden bg-brand-secondary px-6 py-20 sm:py-28"
      data-testid={testId}
      aria-labelledby={headingId}
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
          {eyebrow}
        </p>
        <h1
          id={headingId}
          className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl"
        >
          {children}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">
          {supporting}
        </p>
        {meta ? <div className="mt-4 text-sm font-medium text-emerald-400/90">{meta}</div> : null}
      </div>
    </section>
  );
}
