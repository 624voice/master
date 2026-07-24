import type { ReactNode } from "react";

type DemoBrowserCardProps = {
  children: ReactNode;
  className?: string;
};

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-[#10b981]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function DemoBrowserCard({ children, className = "" }: DemoBrowserCardProps) {
  return (
    <div className={`relative w-full max-w-[740px] ${className}`}>
      <div
        className="pointer-events-none absolute -inset-4 rounded-[28px] bg-[#10b981]/20 blur-3xl motion-safe:animate-[pulse-glow_3s_ease-in-out_infinite]"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-[#F8FAFC] shadow-[0_28px_80px_-20px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-[#EEF2F6] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
            <div className="ml-1 hidden items-center gap-1 text-slate-400 sm:flex">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          <div className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5">
            <LockIcon />
            <span className="truncate text-sm text-[#18222f]/80">demo.624voice.com</span>
          </div>
          <svg className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>

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
  );
}
