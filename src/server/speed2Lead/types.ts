import type { LeadInfo } from "~/lib/lead/validateLead";
import type { TradeKey } from "~/lib/roi/roiModel";
import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";

export type ConversationState =
  | "awaiting_problem"
  | "awaiting_priority"
  | "awaiting_faq_followup"
  | "awaiting_report_assumptions"
  | "awaiting_not_ready_summary"
  | "awaiting_answering_service_gap"
  | "awaiting_office_staff_task"
  | "completed";

export type ConversationContext = {
  flow?: "roi";
  phone: string;
  firstName: string;
  businessName: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
  bookingUrl: string;
  state: ConversationState;
  directOpening?: boolean;
  detectedPains?: PainCategory[];
  lastCustomerMessage?: string;
  updatedAt: string;
};

export type { ContactConversationContext, ContactConversationState } from "~/server/contactSpeed2Lead/types";
export type { DemoConversationContext, DemoConversationState } from "~/server/demoSpeed2Lead/types";

export type AnyConversationContext =
  | ConversationContext
  | import("~/server/contactSpeed2Lead/types").ContactConversationContext
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
  businessName: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
};
