export type DemoConversationState =
  | "awaiting_demo_feature"
  | "awaiting_faq_business_value"
  | "awaiting_faq_after_hours_process"
  | "awaiting_faq_inconsistent_where"
  | "awaiting_faq_routine_questions"
  | "awaiting_booking_value"
  | "awaiting_booking_after_hours_today"
  | "awaiting_booking_scheduling_work"
  | "awaiting_booking_friction"
  | "awaiting_confirmation_value"
  | "awaiting_confirmation_how_confirmed"
  | "awaiting_confirmation_manual_tasks"
  | "awaiting_confirmation_consistency_where"
  | "awaiting_maintenance_value"
  | "awaiting_maintenance_has_plan"
  | "awaiting_maintenance_plan_consistency"
  | "awaiting_maintenance_no_plan_opportunity"
  | "awaiting_maintenance_offer_timing"
  | "awaiting_maintenance_best_fit"
  | "awaiting_multiple_priority"
  | "awaiting_multiple_revenue_opportunity"
  | "awaiting_multiple_workload_task"
  | "awaiting_multiple_both_pressure"
  | "awaiting_not_sure_relevance"
  | "awaiting_not_sure_wait_longest"
  | "awaiting_not_sure_repetitive_task"
  | "awaiting_positive_value"
  | "awaiting_negative_weakness"
  | "awaiting_demo_error_detail"
  | "awaiting_demo_error_useful"
  | "awaiting_624voice_followup"
  | "awaiting_customization_followup"
  | "awaiting_orchestration_followup"
  | "awaiting_office_staff_task"
  | "awaiting_answering_service_gap"
  | "awaiting_already_ai_handling"
  | "awaiting_already_ai_gaps"
  | "awaiting_vague_clarification"
  | "awaiting_vague_revenue_opportunity"
  | "awaiting_vague_workload_task"
  | "awaiting_vague_both_pressure"
  | "awaiting_not_ready_followup"
  | "awaiting_just_testing_followup"
  | "awaiting_just_testing_part"
  | "completed";

export type DemoFollowUpStage = 0 | 1 | 2 | 3;

export type DemoConversationContext = {
  flow: "demo";
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompleted: boolean;
  demoCompletedAt: string;
  bookingUrl: string;
  state: DemoConversationState;
  featureThatStoodOut?: string;
  primaryBusinessOutcome?: string;
  primaryUseCase?: string;
  currentProcess?: string;
  currentProblem?: string;
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
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompletedAt: string;
};
