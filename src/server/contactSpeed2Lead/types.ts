export type ContactConversationState =
  | "awaiting_contact_goal"
  | "awaiting_contact_booking_subgoal"
  | "awaiting_contact_booking_calls_window"
  | "awaiting_contact_booking_response_speed"
  | "awaiting_contact_booking_followup_process"
  | "awaiting_contact_staff_task"
  | "awaiting_contact_staff_time"
  | "awaiting_contact_calls_improvement"
  | "awaiting_contact_calls_fewer_missed"
  | "awaiting_contact_calls_after_hours"
  | "awaiting_contact_calls_consistent_answers"
  | "awaiting_contact_calls_easier_scheduling"
  | "awaiting_contact_both_priority"
  | "awaiting_contact_both_revenue_slippage"
  | "awaiting_contact_both_time_task"
  | "awaiting_contact_something_else"
  | "awaiting_contact_faq_followup"
  | "awaiting_contact_faq_voice"
  | "awaiting_contact_faq_website"
  | "awaiting_contact_info_followup"
  | "awaiting_contact_not_ready_followup"
  | "awaiting_contact_vague_clarification"
  | "awaiting_contact_vague_booking_subgoal"
  | "awaiting_contact_vague_staff_task"
  | "awaiting_contact_vague_calls_improvement"
  | "awaiting_contact_answering_service_gap"
  | "awaiting_contact_office_staff_task"
  | "completed";

export type ContactConversationContext = {
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
  lastCustomerMessage?: string;
  updatedAt: string;
};

export type StartContactSpeed2LeadInput = {
  phone: string;
  firstName: string;
  businessName: string;
  message: string;
};
