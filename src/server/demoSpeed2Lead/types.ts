import type { SessionMemoryFields } from "~/server/speed2Lead/sessionMemoryTypes";

export type DemoConversationState =
  | "awaiting_fit"
  | "awaiting_workload"
  | "awaiting_objection"
  | "awaiting_negative_feedback"
  | "awaiting_demo_error_detail"
  | "awaiting_demo_error_useful"
  | "awaiting_faq_624voice"
  | "awaiting_customization"
  | "awaiting_orchestration"
  | "awaiting_office_staff_task"
  | "awaiting_answering_service_gap"
  | "awaiting_already_ai_handling"
  | "awaiting_already_ai_gaps"
  | "awaiting_not_ready_followup"
  | "awaiting_just_testing_followup"
  | "awaiting_just_testing_part"
  | "awaiting_vague_clarification"
  | "completed";

export type DemoFollowUpStage = 0 | 1 | 2 | 3;

export type DemoConversationContext = SessionMemoryFields & {
  flow: "demo";
  phone: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompleted: boolean;
  demoCompletedAt: string;
  bookingUrl: string;
  state: DemoConversationState;
  bookingLinkSent?: boolean;
  meetingBooked?: boolean;
  customerDeclined?: boolean;
  customerOptedOut?: boolean;
  humanTakeover?: boolean;
  lastCustomerMessage?: string;
  lastAgentMessage?: string;
  followUpStage?: DemoFollowUpStage;
  nextFollowUpAt?: string;
  updatedAt: string;
};

export type StartDemoSpeed2LeadInput = {
  phone: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompletedAt: string;
};
