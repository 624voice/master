import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import {
  DEMO_MAX_CALL_SECONDS,
  getVapiAssistantId,
  getVapiPublicKey,
  isVapiDemoConfigured,
} from "~/config/vapi";
import { JessicaPreview } from "~/components/JessicaPreview";
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
};

const primaryButtonClassName =
  "w-full rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60";

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceDemo({
  lead,
  onDemoLimitReached,
}: VoiceDemoProps) {
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
  }, [clearTimers, lead, onDemoLimitReached, stopCall]);

  if (phase === "idle") {
    return (
      <JessicaPreview
        interactive
        onMicClick={() => void startCall()}
        micLabel="Tap mic to talk with Jessica"
      />
    );
  }

  if (phase === "connecting") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <JessicaPreview
          active
          interactive
          micDisabled
          micLabel="Connecting…"
        />
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-600">Connecting…</p>
        <p className="text-xs text-gray-500">
          Allow microphone access if your browser prompts you.
        </p>
      </div>
    );
  }

  if (phase === "live") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <JessicaPreview
          active={isSpeaking}
          interactive
          micDisabled
          micLabel={isSpeaking ? "Jessica is speaking…" : "You're live"}
        />
        <p className="font-mono text-sm text-brand-primary">
          {formatElapsed(elapsed)} / {formatElapsed(DEMO_MAX_CALL_SECONDS)}
        </p>
        <button
          type="button"
          onClick={() => void stopCall()}
          className="w-full max-w-xs rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          End call
        </button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="space-y-4 py-2 text-center">
        <p className="text-base font-semibold text-brand-primary">
          Thanks for trying the demo!
        </p>
        <p className="text-sm leading-relaxed text-gray-600">
          We&apos;ll follow up with a summary. Ready to see this on your phones?
        </p>
        <button
          type="button"
          onClick={onDemoLimitReached}
          className={primaryButtonClassName}
        >
          Book a meeting
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2 text-center">
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
      <button
        type="button"
        onClick={() => {
          setPhase("idle");
          setError(null);
        }}
        className={primaryButtonClassName}
      >
        Try again
      </button>
    </div>
  );
}
