type JessicaPreviewProps = {
  interactive?: boolean;
  onMicClick?: () => void;
  listening?: boolean;
  speaking?: boolean;
  statusLabel?: string;
};

function SoundwaveBars({ mirrored = false }: { mirrored?: boolean }) {
  const heights = [12, 20, 28, 18, 24, 14, 22, 16];
  return (
    <div
      className={`flex items-center gap-0.5 ${mirrored ? "flex-row-reverse" : ""}`}
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-brand-primary"
          style={{ height: `${height}px`, opacity: 0.45 + (index % 3) * 0.15 }}
        />
      ))}
    </div>
  );
}

function MiniSoundBars() {
  const heights = [8, 12, 10, 14];
  return (
    <span className="inline-flex items-center gap-px" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={index}
          className="w-0.5 rounded-full bg-brand-primary"
          style={{ height: `${height}px` }}
        />
      ))}
    </span>
  );
}

function JessicaAvatar() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand-primary/20 bg-gradient-to-b from-emerald-50 to-white shadow-inner sm:h-28 sm:w-28">
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
  listening = false,
  speaking = false,
  statusLabel,
}: JessicaPreviewProps) {
  const active = listening || speaking;
  const leftLabel = speaking ? "Jessica is speaking…" : "Listening…";
  const rightLabel = statusLabel ?? "You can speak now";

  return (
    <div className="flex flex-col items-center text-center">
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="mb-4 h-10 w-10 opacity-90"
      />

      <div className="flex w-full items-center justify-center gap-3 sm:gap-4">
        <SoundwaveBars />
        <div className={active ? "animate-pulse" : ""}>
          <JessicaAvatar />
        </div>
        <SoundwaveBars mirrored />
      </div>

      <h2 className="mt-5 text-xl font-bold text-brand-secondary">Jessica</h2>
      <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-brand-primary">
        AI VOICE AGENT
      </p>

      <div className="mt-8 flex w-full flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-600 sm:px-3 sm:text-xs">
            <MiniSoundBars />
            <span className="whitespace-nowrap">{leftLabel}</span>
          </span>

          {interactive ? (
            <button
              type="button"
              onClick={onMicClick}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-brand-primary-dark hover:shadow-xl hover:shadow-brand-primary/40"
              aria-label="Start conversation"
            >
              <MicIcon />
            </button>
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg shadow-brand-primary/30"
              aria-hidden="true"
            >
              <MicIcon />
            </div>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-brand-primary sm:px-3 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-brand-primary" />
            <span className="whitespace-nowrap">{rightLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
