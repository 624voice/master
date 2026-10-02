/** Persistent assessment hero — must remain visible on every flow step. */
export function AssessmentPageHero() {
  return (
    <section
      className="bg-brand-secondary px-6 py-16 sm:py-24"
      data-testid="assessment-hero"
      aria-labelledby="assessment-hero-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-brand-mint">
          Business Assessment
        </p>
        <h1
          id="assessment-hero-heading"
          className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
        >
          Find Your{" "}
          <span className="text-brand-mint">Top Priorities</span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-gray-200">
          Six areas where home-service businesses leak revenue and time—ranked for
          your trade and fleet size in a few minutes.
        </p>
      </div>
    </section>
  );
}
