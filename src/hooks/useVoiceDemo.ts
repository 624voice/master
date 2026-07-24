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

export type CallState =
  | "idle"
  | "requestingPermission"
  | "connecting"
  | "listening"
  | "speaking"
  | "ended"
  | "error";

const STATUS_MESSAGES: Record<CallState, string> = {
  idle: "Tap to talk with Jessica",
  requestingPermission: "Allow microphone access to begin",
  connecting: "Connecting to Jessica…",
  listening: "Jessica is listening",
  speaking: "Jessica is speaking",
  ended: "Conversation ended",
  error:
    "We could not access your microphone. Check your browser permissions and try again.",
};

type UseVoiceDemoOptions = {
  lead: DemoLead | null;
  onDemoLimitReached: () => void;
};

export function useVoiceDemo({ lead, onDemoLimitReached }: UseVoiceDemoOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

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
    setCallState("ended");
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      void vapiRef.current?.stop().catch(() => undefined);
    };
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setError(null);
    setElapsed(0);
    setCallState("idle");
  }, [clearTimers]);

  const startCall = useCallback(async () => {
    if (!lead) return;
    if (
      callState === "connecting" ||
      callState === "requestingPermission" ||
      callState === "listening" ||
      callState === "speaking"
    ) {
      return;
    }

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
      setCallState("error");
      return;
    }

    setError(null);
    setCallState("requestingPermission");
    setElapsed(0);

    try {
      const { default: VapiClient } = await import("@vapi-ai/web");
      const publicKey = getVapiPublicKey();
      if (!publicKey) {
        throw new Error("Missing Vapi public key");
      }

      setCallState("connecting");

      const vapi = new VapiClient(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        void recordDemoCallStart({
          data: { email: lead.email, phone: lead.phone },
        }).catch((err) => {
          console.error("Failed to record demo call start:", err);
        });

        setCallState("listening");
        timerRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1000);

        maxTimerRef.current = setTimeout(() => {
          void stopCall();
        }, DEMO_MAX_CALL_SECONDS * 1000);
      });

      vapi.on("call-end", () => {
        clearTimers();
        setCallState("ended");
      });

      vapi.on("speech-start", () => setCallState("speaking"));
      vapi.on("speech-end", () => setCallState("listening"));

      vapi.on("error", (event) => {
        console.error("Vapi error:", event);
        clearTimers();
        setError(
          "We could not connect the call. Check your microphone and try again.",
        );
        setCallState("error");
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
          ? STATUS_MESSAGES.error
          : "Could not start the call. Please try again.";
      setError(message);
      setCallState("error");
    }
  }, [callState, clearTimers, lead, onDemoLimitReached, stopCall]);

  const statusText =
    callState === "error" && error ? error : STATUS_MESSAGES[callState];

  const isBusy =
    callState === "requestingPermission" ||
    callState === "connecting" ||
    callState === "listening" ||
    callState === "speaking";

  return {
    callState,
    statusText,
    elapsed,
    error,
    isBusy,
    startCall,
    stopCall,
    reset,
    maxSeconds: DEMO_MAX_CALL_SECONDS,
  };
}

export function formatDemoElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
