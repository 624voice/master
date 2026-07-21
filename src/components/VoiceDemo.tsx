import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import {
  DEMO_MAX_CALL_SECONDS,
  getVapiAssistantId,
  getVapiPublicKey,
  isVapiDemoConfigured,
} from "~/config/vapi";
import type { DemoLead } from "~/server/submitDemoLead";
import {
  checkDemoEligibility,
  recordDemoCallStart,
} from "~/server/vapi/demoAccess";

type CallPhase =
  | "idle"
  | "connecting"
  | "live"
  | "ended"
  | "error";

type VoiceDemoProps = {
  lead: DemoLead;
  onDemoLimitReached: () => void;
  autoStart?: boolean;
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PhoneIcon() {
  return (
    <svg
      className="h-7 w-7 text-brand-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

export function VoiceDemo({
  lead,
  onDemoLimitReached,
  autoStart = false,
}: VoiceDemoProps) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasAutoStarted = useRef(false);

  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stopCall = useCallback(async () => {
    clearTimers();
    const vapi = vapiRef.current;
    if (vapi) {
      try {
        await vapi.stop();
      } catch {
        // Call may already be ended.
      }
    }
    setIsSpeaking(false);
    setPhase("ended");
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      void vapiRef.current?.stop().catch(() => undefined);
    };
  }, [clearTimers]);

  const startCall = useCallback(async () => {
    try {
      const { allowed } = await checkDemoEligibility({
        data: { email: lead.email, phone: lead.phone },
      });
      if (!allowed) {
        onDemoLimitReached();
        return;
      }
    } catch (err) {
      console.error("Demo eligibility check failed:", err);
    }

    if (!isVapiDemoConfigured()) {
      setError(
        "Voice demo is not configured yet. Please try again later or contact us.",
      );
      setPhase("error");
      return;
    }

    setError(null);
    setPhase("connecting");
    setElapsed(0);

    try {
      const { default: VapiClient } = await import("@vapi-ai/web");
      const publicKey = getVapiPublicKey();
      if (!publicKey) {
        throw new Error("Missing Vapi public key");
      }

      const vapi = new VapiClient(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        void recordDemoCallStart({
          data: { email: lead.email, phone: lead.phone },
        }).catch((err) => {
          console.error("Failed to record demo call start:", err);
        });

        setPhase("live");
        timerRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1000);

        maxTimerRef.current = setTimeout(() => {
          void stopCall();
        }, DEMO_MAX_CALL_SECONDS * 1000);
      });

      vapi.on("call-end", () => {
        clearTimers();
        setIsSpeaking(false);
        setPhase("ended");
      });

      vapi.on("speech-start", () => setIsSpeaking(true));
      vapi.on("speech-end", () => setIsSpeaking(false));

      vapi.on("error", (event) => {
        console.error("Vapi error:", event);
        clearTimers();
        setError(
          "We could not connect the call. Check your microphone and try again.",
        );
        setPhase("error");
      });

      await vapi.start(getVapiAssistantId(), {
        maxDurationSeconds: DEMO_MAX_CALL_SECONDS,
        serverMessages: ["end-of-call-report"],
        metadata: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          businessName: lead.businessName,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          trade: lead.trade,
          fleetSize: lead.fleetSize,
          message: lead.message,
          smsConsent: lead.smsConsent,
          source: "voice_demo",
        },
        variableValues: {
          firstName: lead.firstName,
          businessName: lead.businessName,
          trade: lead.trade,
        },
      });
    } catch (err) {
      console.error("Failed to start Vapi call:", err);
      clearTimers();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access is required to talk with Jessica. Allow mic access in your browser and try again."
          : "Could not start the call. Please try again.";
      setError(message);
      setPhase("error");
    }
  }, [clearTimers, lead, onDemoLimitReached, stopCall]);

  useEffect(() => {
    if (autoStart && !hasAutoStarted.current && phase === "idle") {
      hasAutoStarted.current = true;
      void startCall();
    }
  }, [autoStart, phase, startCall]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-center">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary">
          Hear the difference yourself
        </p>
        <p className="text-[13px] leading-relaxed text-slate-400">
          Talk to her. See exactly what your callers could experience 24/7/365.
        </p>
      </div>

      <div className="w-full rounded-xl border border-slate-400/15 bg-white/[0.03] p-6 text-center sm:p-8">
        <div
          className={`mx-auto mb-3.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 ${
            phase === "live" && isSpeaking
              ? "animate-pulse border-brand-primary bg-brand-primary/20"
              : "border-brand-primary/55 bg-brand-primary/10"
          }`}
        >
          <PhoneIcon />
        </div>

        <p className="mb-1 text-base font-bold text-white">Talk to Jessica</p>
        <p className="mb-4 text-xs text-slate-400">Live AI Demo · 624 Voice</p>

        {phase === "idle" && !autoStart && (
          <>
            <button
              type="button"
              onClick={() => void startCall()}
              className="mb-2.5 w-full rounded-lg bg-brand-primary px-6 py-3.5 text-sm font-bold text-[#18222f] transition-colors hover:bg-brand-primary-dark"
            >
              Get Instant Access
            </button>
            <p className="text-[11px] text-slate-500">1 call per visitor</p>
          </>
        )}

        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-400">Connecting…</p>
          </div>
        )}

        {phase === "live" && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-300">
              {isSpeaking ? "Jessica is speaking…" : "Listening…"}
            </p>
            <p className="font-mono text-sm text-brand-primary">
              {formatElapsed(elapsed)} / {formatElapsed(DEMO_MAX_CALL_SECONDS)}
            </p>
            <button
              type="button"
              onClick={() => void stopCall()}
              className="w-full rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300"
            >
              End call
            </button>
          </div>
        )}

        {phase === "ended" && (
          <div className="space-y-3 py-1">
            <p className="text-sm font-semibold text-brand-primary">
              Thanks for trying the demo!
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              We&apos;ll follow up with a summary. Ready to see this on your
              phones?
            </p>
            <button
              type="button"
              onClick={onDemoLimitReached}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-[#18222f]"
            >
              Book a meeting
            </button>
          </div>
        )}

        {phase === "error" && error && (
          <div className="space-y-3 py-1">
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setError(null);
              }}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-[#18222f]"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <a
        href="/contact"
        className="block w-full rounded-md border border-brand-primary bg-[#1e3a2f] px-5 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-brand-primary no-underline transition-colors hover:bg-[#1e3a2f]/80"
      >
        Want This on Your Phones? →
      </a>
    </div>
  );
}
