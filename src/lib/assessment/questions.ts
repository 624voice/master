export type AssessmentDimension = "GF" | "CV" | "RG" | "RM" | "MI";

export type QuestionType =
  | "business_profile"
  | "respond"
  | "screening"
  | "followup";

export type ChoiceScore = 0 | 1 | 2 | 3;

export type QuestionChoice = {
  label: string;
  score: ChoiceScore;
};

export type AssessmentQuestion = {
  id: string;
  dimension: AssessmentDimension | "Respond" | "business";
  type: QuestionType;
  text: string;
  choices: QuestionChoice[];
  supportsNotSure: boolean;
};

const STANDARD_CHOICES: QuestionChoice[] = [
  { label: "Not at all / rarely", score: 0 },
  { label: "Somewhat / occasionally", score: 1 },
  { label: "Mostly / often", score: 2 },
  { label: "Consistently / always", score: 3 },
];

function screeningQuestion(
  id: string,
  dimension: AssessmentDimension,
  text: string,
): AssessmentQuestion {
  return {
    id,
    dimension,
    type: "screening",
    text,
    choices: STANDARD_CHOICES,
    supportsNotSure: true,
  };
}

function followUpQuestion(
  id: string,
  dimension: AssessmentDimension,
  text: string,
): AssessmentQuestion {
  return {
    id,
    dimension,
    type: "followup",
    text,
    choices: STANDARD_CHOICES,
    supportsNotSure: true,
  };
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "BP1",
    dimension: "business",
    type: "business_profile",
    text: "What type of home-service business do you run?",
    choices: [],
    supportsNotSure: false,
  },
  {
    id: "BP2",
    dimension: "business",
    type: "business_profile",
    text: "How many trucks or service vehicles do you operate?",
    choices: [],
    supportsNotSure: false,
  },
  {
    id: "R1",
    dimension: "Respond",
    type: "respond",
    text: "About how many new inbound calls does your business get in a typical month?",
    choices: [],
    supportsNotSure: true,
  },
  {
    id: "R2",
    dimension: "Respond",
    type: "respond",
    text: "About what percentage of those calls go missed or unanswered?",
    choices: [],
    supportsNotSure: true,
  },
  {
    id: "R3",
    dimension: "Respond",
    type: "respond",
    text: "What is your average job or ticket value?",
    choices: [],
    supportsNotSure: true,
  },
  screeningQuestion(
    "GF-S",
    "GF",
    "How consistently do new customers find your business when they need your services?",
  ),
  screeningQuestion(
    "CV-S",
    "CV",
    "How consistently do inbound leads convert into booked jobs or appointments?",
  ),
  screeningQuestion(
    "RG-S",
    "RG",
    "How consistently do you stay in touch with past customers to earn repeat business?",
  ),
  screeningQuestion(
    "RM-S",
    "RM",
    "How much manual admin work still falls on your team for scheduling and follow-up?",
  ),
  screeningQuestion(
    "MI-S",
    "MI",
    "How clearly can you see which marketing and operations efforts are working?",
  ),
  followUpQuestion(
    "GF-F1",
    "GF",
    "Do you track where new leads come from (calls, web, referrals, ads)?",
  ),
  followUpQuestion(
    "GF-F2",
    "GF",
    "Is your Google Business Profile complete, current, and actively managed?",
  ),
  followUpQuestion(
    "GF-F3",
    "GF",
    "Do you have a simple way for prospects to request service online or after hours?",
  ),
  followUpQuestion(
    "CV-F1",
    "CV",
    "Does every inbound call get answered or returned the same business day?",
  ),
  followUpQuestion(
    "CV-F2",
    "CV",
    "Do you confirm appointments and reduce no-shows with reminders?",
  ),
  followUpQuestion(
    "CV-F3",
    "CV",
    "Do you follow up on estimates or quotes that have not booked yet?",
  ),
  followUpQuestion(
    "RG-F1",
    "RG",
    "Do you reach out to past customers on a regular schedule?",
  ),
  followUpQuestion(
    "RG-F2",
    "RG",
    "Do you ask for reviews or referrals after completed jobs?",
  ),
  followUpQuestion(
    "RG-F3",
    "RG",
    "Do you offer maintenance plans or seasonal check-ins?",
  ),
  followUpQuestion(
    "RM-F1",
    "RM",
    "Does your team still re-enter the same customer details in multiple places?",
  ),
  followUpQuestion(
    "RM-F2",
    "RM",
    "Do dispatch and office staff spend significant time on phone tag?",
  ),
  followUpQuestion(
    "RM-F3",
    "RM",
    "Are invoices, payments, or balance reminders still handled mostly by hand?",
  ),
  followUpQuestion(
    "MI-F1",
    "MI",
    "Can you see booking conversion and missed-call rates for your business?",
  ),
  followUpQuestion(
    "MI-F2",
    "MI",
    "Do you review marketing spend against booked jobs?",
  ),
  followUpQuestion(
    "MI-F3",
    "MI",
    "Do you have a simple dashboard or report your team reviews regularly?",
  ),
];

export const QUESTION_BY_ID = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.id, q]),
) as Record<string, AssessmentQuestion>;

export const INITIAL_ASK_ORDER = [
  "BP1",
  "BP2",
  "R1",
  "R2",
  "R3",
  "GF-S",
  "CV-S",
  "RG-S",
  "RM-S",
  "MI-S",
] as const;

export const SCREENING_IDS_BY_DIMENSION: Record<AssessmentDimension, string> = {
  GF: "GF-S",
  CV: "CV-S",
  RG: "RG-S",
  RM: "RM-S",
  MI: "MI-S",
};

export const FOLLOWUP_IDS_BY_DIMENSION: Record<AssessmentDimension, string[]> = {
  GF: ["GF-F1", "GF-F2", "GF-F3"],
  CV: ["CV-F1", "CV-F2", "CV-F3"],
  RG: ["RG-F1", "RG-F2", "RG-F3"],
  RM: ["RM-F1", "RM-F2", "RM-F3"],
  MI: ["MI-F1", "MI-F2", "MI-F3"],
};

export const ALL_QUESTION_IDS = ASSESSMENT_QUESTIONS.map((q) => q.id);

export const RESPOND_QUESTION_IDS = ["R1", "R2", "R3"] as const;

export const DIMENSION_LABELS: Record<AssessmentDimension | "Respond", string> =
  {
    GF: "Get Found",
    Respond: "Respond",
    CV: "Convert",
    RG: "Retain and Grow",
    RM: "Reduce Manual Work",
    MI: "Measure and Improve",
  };
