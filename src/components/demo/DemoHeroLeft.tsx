type DemoHeroLeftProps = {
  onStartDemo: () => void;
  startDisabled?: boolean;
  showCta?: boolean;
};

function SparkleIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l1.2 4.2L17.5 7.5 13.2 8.7 12 13l-1.2-4.3L6.5 7.5l4.3-1.3L12 2zm7 9l.9 3.1L23 15l-3.1.9L19 19l-.9-3.1L15 15l3.1-.9L19 11zM5 11l.9 3.1L9 15l-3.1.9L5 19l-.9-3.1L1 15l3.1-.9L5 11z" />
    </svg>
  );
}

function CurvedArrow() {
  return (
    <svg
      className="hidden h-8 w-16 shrink-0 text-[#10b981] lg:block"
      viewBox="0 0 64 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 26 C 18 8, 34 6, 58 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M50 10 L58 14 L52 22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DemoHeroLeft({
  onStartDemo,
  startDisabled = false,
  showCta = true,
}: DemoHeroLeftProps) {
  return (
    <div className="flex flex-col text-center lg:text-left">
      <p className="text-[15px] font-semibold uppercase tracking-[0.15em] text-[#10b981]">
        Live AI Voice Demo
      </p>

      <h1 className="mt-4 text-[clamp(2.75rem,6vw,5.25rem)] font-extrabold leading-[0.98] tracking-tight text-white">
        Talk to
        <br />
        <span className="text-[#10b981]">Jessica</span>
      </h1>

      <p className="mt-6 max-w-[540px] text-[clamp(1.25rem,2.2vw,1.85rem)] font-bold leading-snug text-white lg:mx-0 mx-auto">
        Experience what your customers hear when they call your business.
      </p>

      <p className="mt-5 max-w-[570px] text-[17px] leading-[1.55] text-[#94A3B8] lg:mx-0 mx-auto sm:text-lg">
        Jessica can answer questions, qualify callers, book appointments, offer
        maintenance plans, and send confirmations, all in one natural
        conversation.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3 lg:justify-start">
        <CurvedArrow />
        <p className="max-w-xs text-base font-medium text-white/90 sm:text-lg">
          Click the microphone to start a live conversation.
        </p>
      </div>

      {showCta && (
        <div className="mt-8 flex flex-col items-center lg:items-start">
          <button
            type="button"
            onClick={onStartDemo}
            disabled={startDisabled}
            aria-label="Start your demo with Jessica"
            className="inline-flex h-16 w-full max-w-[336px] items-center justify-center gap-3 rounded-xl bg-[#10b981] px-6 text-lg font-semibold text-white shadow-lg shadow-[#10b981]/30 transition-all hover:bg-[#059669] hover:shadow-xl hover:shadow-[#10b981]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#10b981]/40 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[66px] sm:text-xl"
          >
            <SparkleIcon />
            Start Your Demo
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="mt-3 text-sm text-[#94A3B8] sm:text-base">
            Experience Jessica in your browser
          </p>
        </div>
      )}
    </div>
  );
}
