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
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-black/20 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/90" />
        <span className="h-3 w-3 rounded-full bg-amber-400/90" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
