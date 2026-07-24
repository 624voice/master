type JessicaPreviewProps = {
  interactive?: boolean;
  onMicClick?: () => void;
  active?: boolean;
  micDisabled?: boolean;
  micLabel?: string;
};

function SoundwaveLine({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      className={`h-10 w-full min-w-0 flex-1 sm:h-12 ${mirrored ? "scale-x-[-1]" : ""}`}
      viewBox="0 0 160 48"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 24 H8 L10 14 L12 34 L14 10 L16 38 L18 18 L20 30 L22 16 L24 32 L26 12 L28 36 L30 20 L32 28 L34 14 L36 34 L38 18 L40 26 L42 16 L44 30 L46 12 L48 36 L50 22 L52 28 L54 14 L56 32 L58 18 L60 26 L62 16 L64 30 L66 10 L68 38 L70 20 L72 28 L74 14 L76 34 L78 18 L80 26 L82 16 L84 30 L86 12 L88 36 L90 22 L92 28 L94 14 L96 32 L98 18 L100 26 L102 16 L104 30 L106 10 L108 38 L110 20 L112 28 L114 14 L116 34 L118 18 L120 26 L122 16 L124 30 L126 12 L128 36 L130 22 L132 28 L134 14 L136 32 L138 18 L140 26 L142 16 L144 30 L146 12 L148 36 L150 24 H160"
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d="M0 24 H6 L8 20 L10 28 L12 18 L14 30 L16 16 L18 32 L20 20 L22 28 L24 14 L26 34 L28 18 L30 30 L32 16 L34 28 L36 20 L38 26 L40 18 L42 30 L44 16 L46 32 L48 20 L50 28 L52 14 L54 34 L56 18 L58 30 L60 16 L62 28 L64 20 L66 26 L68 18 L70 30 L72 16 L74 32 L76 20 L78 28 L80 14 L82 34 L84 18 L86 30 L88 16 L90 28 L92 20 L94 26 L96 18 L98 30 L100 16 L102 32 L104 20 L106 28 L108 14 L110 34 L112 18 L114 30 L116 16 L118 28 L120 20 L122 26 L124 18 L126 30 L128 16 L130 32 L132 20 L134 28 L136 14 L138 34 L140 18 L142 30 L144 16 L146 28 L148 20 L150 26 L152 18 L154 30 L156 16 L158 24 H160"
        fill="none"
        stroke="#059669"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}

function JessicaAvatar() {
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-brand-primary/25 bg-gradient-to-b from-emerald-50 to-white shadow-inner sm:h-28 sm:w-28">
      <svg
        viewBox="0 0 80 80"
        className="h-16 w-16 text-brand-secondary sm:h-20 sm:w-20"
        aria-hidden="true"
      >
        <rect x="18" y="22" width="44" height="36" rx="12" fill="currentColor" />
        <circle cx="30" cy="38" r="4" fill="#10b981" />
        <circle cx="50" cy="38" r="4" fill="#10b981" />
        <path
          d="M32 48 Q40 54 48 48"
          stroke="#10b981"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M10 34 C10 22 18 14 28 14"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M70 34 C70 22 62 14 52 14"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="8" y="32" width="8" height="14" rx="3" fill="currentColor" />
        <rect x="64" y="32" width="8" height="14" rx="3" fill="currentColor" />
        <path
          d="M34 58 L28 68 L52 68 L46 58 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

function MicIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
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

export function JessicaPreview({
  interactive = false,
  onMicClick,
  active = false,
  micDisabled = false,
  micLabel = "Tap to start",
}: JessicaPreviewProps) {
  const micButtonClassName =
    "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-brand-primary text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:h-20 sm:w-20";

  return (
    <div className="flex flex-col items-center text-center">
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="mb-5 h-9 w-9 opacity-90 sm:h-10 sm:w-10"
      />

      <div className="flex w-full items-center gap-2 sm:gap-3">
        <SoundwaveLine />
        <div className={active ? "animate-pulse" : ""}>
          <JessicaAvatar />
        </div>
        <SoundwaveLine mirrored />
      </div>

      <h2 className="mt-6 text-xl font-bold text-brand-secondary sm:text-2xl">
        Jessica
      </h2>
      <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-brand-primary sm:text-xs">
        AI VOICE AGENT
      </p>

      <div className="mt-8 flex flex-col items-center gap-2">
        {interactive ? (
          <button
            type="button"
            onClick={onMicClick}
            disabled={micDisabled}
            className={`${micButtonClassName} animate-pulse-glow`}
            aria-label={micLabel}
          >
            <MicIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          </button>
        ) : (
          <div
            className={`${micButtonClassName} pointer-events-none`}
            aria-hidden="true"
          >
            <MicIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          </div>
        )}
        {interactive && (
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            {micLabel}
          </p>
        )}
      </div>
    </div>
  );
}
