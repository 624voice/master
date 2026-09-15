export const LIFECYCLE_HEADLINE =
  "Six stages. One connected system moves a customer through all of them. Not every customer needs every capability.";

export const LIFECYCLE_NOTE =
  "The AI Tool Assessment lives inside the paid Diagnostic. It is not a public lifecycle stage.";

export const LIFECYCLE_DIAGRAM_ALT =
  "Customer lifecycle for home services: Get Found, Respond, Convert, Retain and Grow, Reduce Manual Work, and Measure and Improve.";

/** Approved PNG reference (hash-verified); semantic HTML is the primary on-page render. */
export const LIFECYCLE_DIAGRAM_PNG = "/diagram-v3-lifecycle.png";

export const LIFECYCLE_STAGES = [
  { boxLabel: "Found", dimensionLabel: "GET FOUND" },
  { boxLabel: "Responded To", dimensionLabel: "RESPOND" },
  { boxLabel: "Converted", dimensionLabel: "CONVERT" },
  { boxLabel: "Served and Retained", dimensionLabel: "RETAIN AND GROW" },
  { boxLabel: "Operated Efficiently", dimensionLabel: "REDUCE MANUAL WORK" },
  { boxLabel: "Measured and Improved", dimensionLabel: "MEASURE AND IMPROVE" },
] as const;

type CustomerLifecycleDiagramProps = {
  className?: string;
  showHeadline?: boolean;
  showNote?: boolean;
};

export function CustomerLifecycleDiagram({
  className = "",
  showHeadline = true,
  showNote = true,
}: CustomerLifecycleDiagramProps) {
  return (
    <figure className={className} aria-label={LIFECYCLE_DIAGRAM_ALT}>
      {showHeadline ? (
        <p className="mx-auto mb-8 max-w-3xl text-center text-lg font-semibold leading-relaxed text-brand-secondary sm:text-xl">
          {LIFECYCLE_HEADLINE}
        </p>
      ) : null}

      <ol className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[repeat(6,minmax(0,1fr))] md:gap-2 lg:gap-3">
        {LIFECYCLE_STAGES.map((stage, index) => (
          <li key={stage.dimensionLabel} className="flex flex-col items-stretch">
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="relative flex w-full flex-1 flex-col items-center justify-center rounded-xl bg-brand-primary px-3 py-5 text-white shadow-sm sm:px-4 sm:py-6">
                <span className="text-sm font-semibold leading-snug sm:text-base">
                  {stage.boxLabel}
                </span>
                {index < LIFECYCLE_STAGES.length - 1 ? (
                  <span
                    className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-xl font-bold text-brand-secondary md:inline"
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-secondary sm:text-sm">
                {stage.dimensionLabel}
              </p>
            </div>
            {index < LIFECYCLE_STAGES.length - 1 ? (
              <span
                className="my-2 text-center text-xl font-bold text-brand-secondary md:hidden"
                aria-hidden="true"
              >
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {showNote ? (
        <figcaption className="mx-auto mt-8 max-w-2xl text-center text-sm italic text-gray-500">
          {LIFECYCLE_NOTE}
        </figcaption>
      ) : null}
    </figure>
  );
}
