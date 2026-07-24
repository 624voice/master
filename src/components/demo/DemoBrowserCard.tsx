import type { ReactNode } from "react";

type DemoBrowserCardProps = {
  children: ReactNode;
  className?: string;
};

/** Uniform card scale — shrinks rendered + layout size without changing CSS token sizes. */
const CARD_SCALE = 0.84;

export function DemoBrowserCard({ children, className = "" }: DemoBrowserCardProps) {
  return (
    <div
      className={`mx-auto w-full overflow-visible lg:mx-0 ${className}`}
      style={{ maxWidth: `${740 * CARD_SCALE}px` }}
    >
      <div
        className="relative w-full max-w-[740px] overflow-visible pt-1"
        style={{ zoom: CARD_SCALE }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] bg-[#10b981]/20 blur-2xl motion-safe:animate-[pulse-glow_3s_ease-in-out_infinite]"
          aria-hidden="true"
        />
        <div className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-[#F8FAFC] shadow-[0_28px_80px_-20px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" aria-hidden="true" className="h-7 w-7" />
              <span className="text-sm font-bold text-[#18222f]">
                624 <span className="text-[#10b981]">Voice</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#18222f]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981] motion-safe:animate-pulse" />
              Jessica is online
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
