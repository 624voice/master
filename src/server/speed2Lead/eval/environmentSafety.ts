export type PreviewSharedResources = {
  redis: "shared_if_configured";
  twilio: "shared_if_configured";
  googleCalendar: "shared_if_configured";
  transcriptWebhook: "shared_if_configured";
  sessionStorage: "shared_if_configured";
};

export type EvalIsolationReport = {
  previewUrl: string;
  previewSharesWithProduction: PreviewSharedResources;
  harnessTouchesProductionRedis: false;
  harnessSendsRealSms: false;
  harnessCreatesRealCalendarEvents: false;
  harnessUsesSyntheticPhones: true;
  isolationMechanism: string[];
};

const PREVIEW_URL = "https://deploy-preview-61--624voice.netlify.app";

export function buildEnvironmentSafetyReport(): EvalIsolationReport {
  return {
    previewUrl: PREVIEW_URL,
    previewSharesWithProduction: {
      redis: "shared_if_configured",
      twilio: "shared_if_configured",
      googleCalendar: "shared_if_configured",
      transcriptWebhook: "shared_if_configured",
      sessionStorage: "shared_if_configured",
    },
    harnessTouchesProductionRedis: false,
    harnessSendsRealSms: false,
    harnessCreatesRealCalendarEvents: false,
    harnessUsesSyntheticPhones: true,
    isolationMechanism: [
      "Calls orchestrateInboundTurn() directly — never handleInboundSms(), saveSession(), or Twilio send paths",
      "Uses synthetic +1555999xxxx phones that are never written to Upstash",
      "Mocks getConsultationSlots() and bookConsultation() — no Google Calendar API calls",
      "No LEADS_WEBHOOK_URL or transcript POSTs from the harness",
      "Eval flag S2L_LIVE_EVAL must be true; production webhook unchanged",
    ],
  };
}

export function assertEvalHarnessSafe(): void {
  if (process.env.S2L_LIVE_EVAL !== "true") {
    throw new Error("Refusing to run live eval without S2L_LIVE_EVAL=true");
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for live eval");
  }
  if (process.env.S2L_LIVE_EVAL_ALLOW_PRODUCTION_SIDE_EFFECTS === "true") {
    throw new Error("Production side effects are explicitly forbidden for live eval");
  }
}
