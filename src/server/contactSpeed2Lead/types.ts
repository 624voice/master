import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";
import type { SessionMemoryFields } from "~/server/speed2Lead/sessionMemoryTypes";

export type ContactConversationState =
  | "awaiting_prompt"
  | "awaiting_follow_up"
  | "awaiting_info_area"
  | "awaiting_faq_followup"
  | "awaiting_not_ready_followup"
  | "awaiting_info_followup"
  | "awaiting_answering_service_gap"
  | "awaiting_office_staff_task"
  | "completed";

export type ContactFollowUpKind =
  | "missed_calls"
  | "website"
  | "general"
  | "none";

export type ContactConversationContext = SessionMemoryFields & {
  flow: "contact";
  phone: string;
  firstName: string;
  businessName: string;
  shortNeedSummary: string;
  relevantSolution: string;
  relevantLink: string;
  relevantExample: string;
  bookingUrl: string;
  state: ContactConversationState;
  followUpKind?: ContactFollowUpKind;
  detectedPains?: PainCategory[];
  lastCustomerMessage?: string;
  updatedAt: string;
};

export type StartContactSpeed2LeadInput = {
  phone: string;
  firstName: string;
  businessName: string;
  message: string;
};
