import type { CallState } from "~/hooks/useVoiceDemo";
import { formatDemoElapsed } from "~/hooks/useVoiceDemo";
import { DemoWaveform } from "~/components/demo/DemoWaveform";

type DemoJessicaInterfaceProps = {
  callState: CallState;
  statusText: string;
  onMicClick: () => void;
  onEndCall?: () => void;
  onTryAgain?: () => void;
  onBookMeeting?: () => void;
  micDisabled?: boolean;
  elapsed?: number;
  maxSeconds?: number;
};

function MicIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export function DemoJessicaInterface({
  callState,
  statusText,
  onMicClick,
  onEndCall,
  onTryAgain,
  onBookMeeting,
  micDisabled = false,
  elapsed = 0,
  maxSeconds = 0,
}: DemoJessicaInterfaceProps) {
  const isLive = callState === "listening" || callState === "speaking";
  const isConnecting =
    callState === "connecting" || callState === "requestingPermission";
  const micInteractive = !micDisabled && !isLive && callState !== "ended";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-[#10b981]/10" aria-hidden="true" />
        <div className="relative rounded-full border-4 border-[#10b981]/30 bg-[#ecfdf5] p-1">
          <img
            src="/jessica-avatar.png"
            alt="Jessica, AI voice agent"
            className="h-[148px] w-[148px] rounded-full object-cover object-top sm:h-[168px] sm:w-[168px]"
          />
        </div>
      </div>

      <h2 className="mt-6 text-[2.35rem] font-bold leading-none text-[#18222f]">Jessica</h2>
      <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-[#10b981]">
        AI VOICE AGENT
      </p>

      <DemoWaveform callState={callState} className="mt-6" />

      <div className="mt-8 flex flex-col items-center">
        {micInteractive ? (
          <button
            type="button"
            onClick={onMicClick}
            disabled={micDisabled || isConnecting}
            aria-label="Start live demo with Jessica"
            className={`relative flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#10b981] text-white shadow-lg shadow-[#10b981]/35 transition-all hover:scale-[1.03] hover:bg-[#059669] hover:shadow-xl hover:shadow-[#10b981]/45 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#10b981]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:h-[112px] sm:w-[112px] ${
              callState === "idle"
                ? "motion-safe:animate-[pulse-glow_2s_ease-in-out_infinite]"
                : ""
            }`}
          >
            <span className="absolute inset-0 rounded-full ring-4 ring-[#10b981]/15" aria-hidden="true" />
            {isConnecting ? (
              <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
            ) : (
              <MicIcon />
            )}
          </button>
        ) : (
          <div
            className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#10b981] text-white opacity-80 sm:h-[112px] sm:w-[112px]"
            aria-hidden="true"
          >
            <MicIcon />
          </div>
        )}

        <p
          className="mt-4 max-w-xs text-center text-base font-medium text-[#18222f] sm:text-lg"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusText}
        </p>

        {isLive && onEndCall && (
          <>
            <p className="mt-2 font-mono text-sm text-[#10b981]">
              {formatDemoElapsed(elapsed)} / {formatDemoElapsed(maxSeconds)}
            </p>
            <button
              type="button"
              onClick={onEndCall}
              className="mt-4 w-full max-w-xs rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              End call
            </button>
          </>
        )}

        {callState === "ended" && onBookMeeting && (
          <button
            type="button"
            onClick={onBookMeeting}
            className="mt-4 w-full max-w-xs rounded-xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#059669]"
          >
            Book a meeting
          </button>
        )}

        {callState === "error" && onTryAgain && (
          <button
            type="button"
            onClick={onTryAgain}
            className="mt-4 w-full max-w-xs rounded-xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#059669]"
          >
            Try again
          </button>
        )}
      </div>

      <div className="mt-8 w-full border-t border-slate-200 pt-6">
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="flex items-start gap-3">
            <UserIcon />
            <p className="text-sm leading-snug text-[#18222f]">
              1 live demo
              <br />
              per visitor
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldIcon />
            <p className="text-sm leading-snug text-[#18222f]">
              Browser-based
              <br />
              no installation required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
