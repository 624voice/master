import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import {
  DEMO_MAX_CALL_SECONDS,
  getVapiAssistantId,
  getVapiPublicKey,
  isVapiDemoConfigured,
} from "~/config/vapi";
import type { DemoLead } from "~/server/submitDemoLead";

type CallPhase =
  | "idle"
  | "connecting"
  | "live"
  | "ended"
  | "error";

type VoiceDemoProps = {
  lead: DemoLead;
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceDemo({ lead }: VoiceDemoProps) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  const startCall = async () => {
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
        metadata: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          businessName: lead.businessName,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          smsConsent: lead.smsConsent,
          source: "voice_demo",
        },
        variableValues: {
          firstName: lead.firstName,
          businessName: lead.businessName,
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
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-brand-secondary p-8 text-white shadow-xl">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-400">
          Live voice demo
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-comfortaa)] text-2xl font-bold">
          Talk to Jessica
        </h2>
        <p className="mt-3 text-sm text-gray-300">
          Have a live conversation with our AI receptionist — up to{" "}
          {DEMO_MAX_CALL_SECONDS / 60} minutes.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-6">
        {phase === "idle" && (
          <button
            type="button"
            onClick={() => void startCall()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-brand-primary-dark"
          >
            <span aria-hidden="true">🎙️</span>
            Start conversation
          </button>
        )}

        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-300">Connecting…</p>
          </div>
        )}

        {phase === "live" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full border-2 ${
                isSpeaking
                  ? "border-emerald-400 bg-emerald-500/20 animate-pulse"
                  : "border-gray-500 bg-white/5"
              }`}
              aria-live="polite"
            >
              <span className="text-3xl" aria-hidden="true">
                {isSpeaking ? "🔊" : "🎧"}
              </span>
            </div>
            <p className="text-sm text-gray-300">
              {isSpeaking ? "Jessica is speaking…" : "Listening…"}
            </p>
            <p className="font-mono text-lg text-emerald-400">
              {formatElapsed(elapsed)} / {formatElapsed(DEMO_MAX_CALL_SECONDS)}
            </p>
            <button
              type="button"
              onClick={() => void stopCall()}
              className="rounded-lg border border-red-400/60 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
            >
              End call
            </button>
          </div>
        )}

        {phase === "ended" && (
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-400">
              Thanks for trying the demo!
            </p>
            <p className="mt-2 text-sm text-gray-300">
              We&apos;ll send you a summary and follow up soon.
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setElapsed(0);
                setError(null);
              }}
              className="mt-6 rounded-lg border border-gray-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              Start another call
            </button>
          </div>
        )}

        {phase === "error" && error && (
          <div className="text-center">
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setError(null);
              }}
              className="mt-4 rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
