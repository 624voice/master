import type { ReactNode } from "react";

function VoiceWaveSvg() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="demo-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#162736" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="demo-wave-a" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="35%" stopColor="#34d399" stopOpacity="0.75" />
          <stop offset="65%" stopColor="#10b981" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="demo-wave-b" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669" stopOpacity="0" />
          <stop offset="40%" stopColor="#10b981" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="800" height="520" fill="#162736" />
      <rect width="800" height="520" fill="url(#demo-glow)" />

      {Array.from({ length: 56 }).map((_, index) => {
        const angle = (index / 56) * 360;
        return (
          <line
            key={angle}
            x1="400"
            y1="210"
            x2={400 + Math.cos((angle * Math.PI) / 180) * 440}
            y2={210 + Math.sin((angle * Math.PI) / 180) * 440}
            stroke={index % 2 === 0 ? "#10b981" : "#059669"}
            strokeOpacity={index % 3 === 0 ? 0.28 : 0.12}
            strokeWidth="1.2"
          />
        );
      })}

      <path
        d="M-40 250 C 120 180, 280 320, 420 250 S 700 180, 860 250"
        fill="none"
        stroke="url(#demo-wave-a)"
        strokeWidth="4"
      />
      <path
        d="M-40 270 C 140 340, 300 200, 440 270 S 720 340, 860 270"
        fill="none"
        stroke="url(#demo-wave-b)"
        strokeWidth="3"
      />
      <path
        d="M-40 230 C 100 300, 260 160, 400 230 S 680 300, 860 230"
        fill="none"
        stroke="#10b981"
        strokeOpacity="0.25"
        strokeWidth="2"
      />

      <circle cx="400" cy="210" r="96" fill="#10b981" fillOpacity="0.1" />
      <circle
        cx="400"
        cy="210"
        r="64"
        fill="none"
        stroke="#10b981"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      className="h-8 w-8 text-brand-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

type DemoAgentPanelProps = {
  children: ReactNode;
  className?: string;
  showHero?: boolean;
};

export function DemoAgentPanel({
  children,
  className = "",
  showHero = false,
}: DemoAgentPanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-900/30 ${className}`}
    >
      <VoiceWaveSvg />

      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 opacity-[0.14] sm:h-40 sm:w-40"
      />

      {showHero && (
        <div
          className="pointer-events-none absolute left-1/2 top-[38%] flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 backdrop-blur-sm"
          aria-hidden="true"
        >
          <MicIcon />
        </div>
      )}

      <div className="relative z-10 bg-brand-secondary/50 p-4 backdrop-blur-[1px] sm:p-5">
        {children}
      </div>
    </div>
  );
}
