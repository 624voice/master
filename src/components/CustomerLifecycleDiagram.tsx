import {
  CUSTOMER_JOURNEY_ARIA_LABEL,
  CUSTOMER_JOURNEY_HEADLINE,
  CUSTOMER_JOURNEY_STAGES,
} from "~/content/customerJourneyStages";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";

/** @deprecated Use CUSTOMER_JOURNEY_HEADLINE */
export const LIFECYCLE_HEADLINE = CUSTOMER_JOURNEY_HEADLINE;

/** Optional supporting note beneath the lifecycle diagram (no paid-diagnostic language). */
export const LIFECYCLE_NOTE = "";

export const LIFECYCLE_DIAGRAM_ALT = CUSTOMER_JOURNEY_ARIA_LABEL;

export const LIFECYCLE_STAGES = CUSTOMER_JOURNEY_STAGES.map((stage) => ({
  boxLabel: stage.primaryLabel,
  dimensionLabel: stage.dimensionLabel,
}));

type CustomerLifecycleDiagramProps = {
  className?: string;
  showHeadline?: boolean;
  showNote?: boolean;
};

function StageCard({
  stage,
}: {
  stage: (typeof CUSTOMER_JOURNEY_STAGES)[number];
}) {
  return (
    <div
      className={`flex h-full min-h-[8.5rem] flex-col rounded-xl border p-4 shadow-sm sm:min-h-[9rem] sm:p-5 ${stage.accentClass}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 text-brand-primary-dark shadow-sm">
          <JourneyStageIcon iconId={stage.iconId} className="h-5 w-5" />
        </span>
        <span className="sr-only">{stage.dimensionLabel}: </span>
        <span className="text-xs font-bold uppercase tracking-wide text-brand-primary-dark">
          {stage.dimensionLabel}
        </span>
      </div>
      <p className="text-base font-bold leading-snug text-brand-secondary">
        {stage.primaryLabel}
      </p>
      <p className="mt-2 text-sm leading-snug text-gray-600">{stage.description}</p>
    </div>
  );
}

export function CustomerLifecycleDiagram({
  className = "",
  showHeadline = true,
  showNote = false,
}: CustomerLifecycleDiagramProps) {
  return (
    <figure className={className} aria-label={CUSTOMER_JOURNEY_ARIA_LABEL}>
      {showHeadline ? (
        <p className="mx-auto mb-8 max-w-3xl text-center text-lg font-semibold leading-relaxed text-brand-secondary sm:text-xl">
          {CUSTOMER_JOURNEY_HEADLINE}
        </p>
      ) : null}

      {/* Mobile + narrow: vertical progression */}
      <ol className="mx-auto flex max-w-md list-none flex-col gap-0 p-0 md:hidden">
        {CUSTOMER_JOURNEY_STAGES.map((stage, index) => (
          <li key={stage.id}>
            <StageCard stage={stage} />
            {index < CUSTOMER_JOURNEY_STAGES.length - 1 ? (
              <div className="flex justify-center py-2" aria-hidden="true">
                <span className="text-lg text-brand-accent">↓</span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {/* Tablet: two rows of three */}
      <ol className="mx-auto hidden max-w-4xl list-none grid-cols-2 gap-4 p-0 md:grid lg:hidden">
        {CUSTOMER_JOURNEY_STAGES.map((stage) => (
          <li key={stage.id} className="min-w-0">
            <StageCard stage={stage} />
          </li>
        ))}
      </ol>

      {/* Desktop: horizontal with connectors between cards (not overlapping) */}
      <ol className="mx-auto hidden max-w-6xl list-none items-stretch gap-0 p-0 lg:flex">
        {CUSTOMER_JOURNEY_STAGES.map((stage, index) => (
          <li key={stage.id} className="flex min-w-0 flex-1 items-stretch">
            <div className="min-w-0 flex-1">
              <StageCard stage={stage} />
            </div>
            {index < CUSTOMER_JOURNEY_STAGES.length - 1 ? (
              <div
                className="flex w-8 flex-shrink-0 items-center justify-center self-center px-0.5"
                aria-hidden="true"
              >
                <span className="text-sm font-semibold text-brand-accent">→</span>
              </div>
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
