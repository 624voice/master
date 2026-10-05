import type { ReactNode } from "react";
import { JourneyStageIcon } from "~/components/marketing/JourneyStageIcon";

export function OutcomeCard({
  title,
  body,
  icon,
  accent = "mint",
}: {
  title: string;
  body: string;
  icon: ReactNode;
  accent?: "mint" | "aqua" | "sky" | "neutral";
}) {
  const accentBar = {
    mint: "bg-brand-mint",
    aqua: "bg-brand-aqua",
    sky: "bg-brand-sky",
    neutral: "bg-brand-accent",
  }[accent];

  return (
    <article className="relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-brand-accent-light/40 p-6 shadow-sm">
      <span className={`absolute left-0 top-0 h-1 w-full ${accentBar}`} aria-hidden="true" />
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary-dark">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
    </article>
  );
}

/** Problem / pain cards — coral accent, equal-height grid on homepage. */
export function ProblemPainCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-rose-100/80 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{body}</p>
    </article>
  );
}

export function JourneyStageCard({
  primaryLabel,
  description,
  iconId,
  accentClass,
}: {
  primaryLabel: string;
  description: string;
  iconId: string;
  accentClass: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-4 shadow-sm sm:p-5 ${accentClass}`}
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/70 text-brand-primary-dark shadow-sm">
        <JourneyStageIcon iconId={iconId} className="h-6 w-6" />
      </div>
      <p className="text-base font-bold text-brand-secondary">{primaryLabel}</p>
      <p className="mt-2 flex-1 text-sm leading-snug text-gray-600">{description}</p>
    </div>
  );
}

export function ProcessStepCard({
  step,
  title,
  body,
  deliverable,
  icon,
  note,
}: {
  step: number;
  title: string;
  body: string;
  deliverable: string;
  icon: ReactNode;
  note?: string;
}) {
  return (
    <article className="relative flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-md sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
          {step}
        </span>
        <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-mint/30 text-brand-primary-dark">
          {icon}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-brand-secondary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
      {note ? (
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{note}</p>
      ) : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-primary-dark">
        Deliverable: {deliverable}
      </p>
    </article>
  );
}

export function ProofHighlightCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border-2 border-brand-secondary/20 bg-brand-secondary px-6 py-7 text-white shadow-lg sm:p-8">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-200">{body}</p>
    </article>
  );
}

export function CtaCard({
  title,
  body,
  href,
  ctaLabel,
}: {
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary-light via-white to-brand-aqua/20 p-8 shadow-lg">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-primary/10 blur-2xl"
        aria-hidden="true"
      />
      <WaveformDetail className="pointer-events-none absolute bottom-4 right-4 opacity-30" />
      <h3 className="relative text-2xl font-bold text-brand-secondary">{title}</h3>
      <p className="relative mt-3 max-w-xl text-base leading-relaxed text-gray-600">{body}</p>
      <a
        href={href}
        className="relative mt-6 inline-flex rounded-lg bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-dark"
      >
        {ctaLabel}
      </a>
    </div>
  );
}

export function WaveformDetail({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-10 w-24 text-brand-primary ${className}`}
      viewBox="0 0 96 40"
      aria-hidden="true"
    >
      {[8, 14, 22, 18, 28, 16, 24, 12, 20].map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 2}
          y={(40 - h) / 2}
          width={6}
          height={h}
          rx={2}
          fill="currentColor"
          opacity={0.5 + (i % 3) * 0.15}
        />
      ))}
    </svg>
  );
}
