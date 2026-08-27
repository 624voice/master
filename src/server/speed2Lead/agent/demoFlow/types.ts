export type DemoCallOutcome = "full" | "short";

export type DemoSummary = {
  serviceAreaChecked: boolean;
  schedulingFlowCompleted: boolean;
  /** Jessica's fake in-demo booking — never treated as a real booking. */
  appointmentBookedInDemo: boolean;
  objectionsRaised: string[];
  upsellPresented: boolean;
  topPositiveMoment: string | null;
  topConcern: string | null;
  prospectSentiment: "positive" | "neutral" | "negative";
};

export type DemoAgentSessionFields = {
  vapiCallId?: string;
  callDurationSeconds?: number;
  callOutcome?: DemoCallOutcome;
  demoSummary?: DemoSummary | null;
};
