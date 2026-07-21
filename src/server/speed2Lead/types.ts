import type { LeadInfo } from "~/lib/lead/validateLead";
import type { TradeKey } from "~/lib/roi/roiModel";

export type ConversationState =
  | "awaiting_goal"
  | "awaiting_booking_subgoal"
  | "awaiting_booking_calls_window"
  | "awaiting_booking_response_speed"
  | "awaiting_booking_followup_process"
  | "awaiting_staff_pressure"
  | "awaiting_staff_time_estimate"
  | "awaiting_both_priority"
  | "awaiting_both_revenue_subgoal"
  | "awaiting_both_revenue_detail"
  | "awaiting_both_time_task"
  | "awaiting_not_sure_frustration"
  | "awaiting_faq_followup"
  | "awaiting_report_assumptions"
  | "awaiting_not_ready_summary"
  | "awaiting_vague_clarification"
  | "awaiting_vague_booking_subgoal"
  | "awaiting_vague_staff_task"
  | "awaiting_vague_both_priority"
  | "awaiting_vague_both_revenue_slippage"
  | "awaiting_vague_both_time_task"
  | "awaiting_answering_service_gap"
  | "awaiting_office_staff_task"
  | "completed";

export type ConversationTrack = "staff";

export type ConversationContext = {
  phone: string;
  firstName: string;
  businessName: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
  bookingUrl: string;
  state: ConversationState;
  track?: ConversationTrack;
  updatedAt: string;
};

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
