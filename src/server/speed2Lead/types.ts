import type { LeadInfo } from "~/lib/lead/validateLead";
import type { TradeKey } from "~/lib/roi/roiModel";
import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";
import type { SessionMemoryFields } from "~/server/speed2Lead/sessionMemoryTypes";

export type ConversationState =
  | "awaiting_problem"
  | "awaiting_priority"
  | "awaiting_faq_followup"
  | "awaiting_report_assumptions"
  | "awaiting_not_ready_summary"
  | "awaiting_answering_service_gap"
  | "awaiting_office_staff_task"
  | "completed";

export type ConversationContext = SessionMemoryFields & {
  flow?: "roi";
  phone: string;
  firstName: string;
  businessName: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  trade?: TradeKey;
  truckCount?: number;
  monthlyCalls?: number;
  reportUrl: string;
  bookingUrl: string;
  state: ConversationState;
  detectedPains?: PainCategory[];
  lastCustomerMessage?: string;
  updatedAt: string;
};

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

export type ContactFollowUpKind = "missed_calls" | "website" | "general" | "none";

/** Legacy contact store shape — retained for Redis deserialization only. */
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

export type { DemoConversationContext, DemoConversationState } from "~/server/demoSpeed2Lead/types";

export type AnyConversationContext =
  | ConversationContext
  | ContactConversationContext
  | import("~/server/demoSpeed2Lead/types").DemoConversationContext;

export type ReportTokenData = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
};

export type StartSpeed2LeadInput = {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  email?: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  trade?: TradeKey;
  truckCount?: number;
  monthlyCalls?: number;
  reportUrl: string;
};
