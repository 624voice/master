import type { ReactNode } from "react";

type DemoBrowserCardProps = {
  children: ReactNode;
  className?: string;
};

export function DemoBrowserCard({ children, className = "" }: DemoBrowserCardProps) {
  return (
    <div className={`mx-auto w-full max-w-[680px] overflow-visible lg:mx-0 ${className}`}>
      <div className="relative w-full overflow-visible">
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] bg-[#10b981]/20 blur-2xl motion-safe:animate-[pulse-glow_3s_ease-in-out_infinite]"
          aria-hidden="true"
        />
        <div className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-[#F8FAFC] shadow-[0_28px_80px_-20px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-2.5 sm:px-6">
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

          <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
