/** Six-stage customer journey (diagram + accessible descriptions). */
export const CUSTOMER_JOURNEY_STAGES = [
  {
    id: "get-found",
    dimensionLabel: "GET FOUND",
    primaryLabel: "Found",
    description:
      "Help the right homeowners find and trust the business.",
    accentClass: "bg-brand-sky/15 border-brand-sky/40 text-brand-secondary",
    iconId: "compass",
  },
  {
    id: "respond",
    dimensionLabel: "RESPOND",
    primaryLabel: "Responded To",
    description:
      "Answer and move new opportunities forward while the need is active.",
    accentClass: "bg-brand-mint/20 border-brand-mint/50 text-brand-secondary",
    iconId: "phone",
  },
  {
    id: "convert",
    dimensionLabel: "CONVERT",
    primaryLabel: "Converted",
    description:
      "Turn qualified opportunities into booked work.",
    accentClass: "bg-brand-aqua/15 border-brand-aqua/40 text-brand-secondary",
    iconId: "calendar",
  },
  {
    id: "retain",
    dimensionLabel: "RETAIN AND GROW",
    primaryLabel: "Served and Retained",
    description:
      "Keep customers connected through reviews, reminders, relevant offers, and reactivation.",
    accentClass: "bg-brand-primary-light/80 border-brand-primary/25 text-brand-secondary",
    iconId: "heart",
  },
  {
    id: "reduce-manual",
    dimensionLabel: "REDUCE MANUAL WORK",
    primaryLabel: "Operated Efficiently",
    description:
      "Connect systems and reduce repetitive administrative work.",
    accentClass: "bg-brand-accent-light border-gray-200 text-brand-secondary",
    iconId: "gears",
  },
  {
    id: "measure",
    dimensionLabel: "MEASURE AND IMPROVE",
    primaryLabel: "Measured and Improved",
    description:
      "Use reporting and reviews to improve the next decision.",
    accentClass: "bg-brand-secondary/5 border-brand-secondary/20 text-brand-secondary",
    iconId: "chart",
  },
] as const;

export const CUSTOMER_JOURNEY_HEADLINE =
  "Six stages. One connected system moves a customer through all of them. Not every customer needs every capability.";

export const CUSTOMER_JOURNEY_ARIA_LABEL =
  "Customer lifecycle for home services: Get Found, Respond, Convert, Retain and Grow, Reduce Manual Work, and Measure and Improve.";
