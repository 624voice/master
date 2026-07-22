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
        <radialGradient id="demo-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#10b981" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#162736" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="demo-wave-a" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="35%" stopColor="#34d399" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#10b981" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="demo-wave-b" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669" stopOpacity="0" />
          <stop offset="40%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="800" height="520" fill="#162736" />
      <rect width="800" height="520" fill="url(#demo-glow)" />

      {/* Radial burst */}
      {Array.from({ length: 48 }).map((_, index) => {
        const angle = (index / 48) * 360;
        return (
          <line
            key={angle}
            x1="400"
            y1="220"
            x2={400 + Math.cos((angle * Math.PI) / 180) * 420}
            y2={220 + Math.sin((angle * Math.PI) / 180) * 420}
            stroke={index % 2 === 0 ? "#10b981" : "#059669"}
            strokeOpacity={index % 3 === 0 ? 0.18 : 0.08}
            strokeWidth="1"
          />
        );
      })}

      {/* Flowing wave ribbons */}
      <path
        d="M-40 250 C 120 180, 280 320, 420 250 S 700 180, 860 250"
        fill="none"
        stroke="url(#demo-wave-a)"
        strokeWidth="3"
      />
      <path
        d="M-40 270 C 140 340, 300 200, 440 270 S 720 340, 860 270"
        fill="none"
        stroke="url(#demo-wave-b)"
        strokeWidth="2.5"
      />
      <path
        d="M-40 230 C 100 300, 260 160, 400 230 S 680 300, 860 230"
        fill="none"
        stroke="#10b981"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />

      {/* Center halo */}
      <circle cx="400" cy="220" r="88" fill="#10b981" fillOpacity="0.06" />
      <circle
        cx="400"
        cy="220"
        r="58"
        fill="none"
        stroke="#10b981"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
    </svg>
  );
}

type DemoAgentPanelProps = {
  children: ReactNode;
  className?: string;
};

export function DemoAgentPanel({ children, className = "" }: DemoAgentPanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-500/20 shadow-2xl shadow-black/30 ${className}`}
    >
      <VoiceWaveSvg />

      {/* Translucent logo watermark */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[42%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 opacity-[0.12] sm:h-36 sm:w-36"
      />

      <div className="relative z-10 bg-brand-secondary/55 p-6 backdrop-blur-[2px] sm:p-8">
        {children}
      </div>
    </div>
  );
}
