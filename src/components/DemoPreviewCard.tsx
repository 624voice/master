import type { ReactNode } from "react";

type DemoPreviewCardProps = {
  children: ReactNode;
  className?: string;
};

export function DemoPreviewCard({
  children,
  className = "",
}: DemoPreviewCardProps) {
  return (
    <div className={`relative mx-auto w-full max-w-lg ${className}`}>
      <div
        className="pointer-events-none absolute -inset-3 rounded-3xl bg-brand-primary/15 blur-2xl sm:-inset-4"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-white p-6 shadow-2xl shadow-emerald-950/30 sm:p-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-50/80 to-transparent"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
