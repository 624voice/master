/** Six-stage customer journey (diagram + accessible descriptions). */
export const CUSTOMER_JOURNEY_STAGES = [
  {
    id: "get-found",
    dimensionLabel: "GET FOUND",
    primaryLabel: "Get Found",
    description: "Help the right homeowners find and trust your business.",
    accentClass: "bg-brand-sky/15 border-brand-sky/40 text-brand-secondary",
    iconId: "compass",
  },
  {
    id: "respond",
    dimensionLabel: "RESPOND",
    primaryLabel: "Respond Immediately",
    description:
      "Effortlessly start the conversation with your customer while the need is active.",
    accentClass: "bg-brand-mint/20 border-brand-mint/50 text-brand-secondary",
    iconId: "phone",
  },
  {
    id: "convert",
    dimensionLabel: "CONVERT",
    primaryLabel: "Convert",
    description: "Automatically turn qualified opportunities into booked work.",
    accentClass: "bg-brand-aqua/15 border-brand-aqua/40 text-brand-secondary",
    iconId: "calendar",
  },
  {
    id: "retain",
    dimensionLabel: "RETAIN",
    primaryLabel: "Retain and Grow",
    description:
      "Seamlessly keep customers connected through reviews, reminders, relevant offers, and reactivation.",
    accentClass: "bg-brand-primary-light/80 border-brand-primary/25 text-brand-secondary",
    iconId: "heart",
  },
  {
    id: "reduce-manual",
    dimensionLabel: "EFFICIENCY",
    primaryLabel: "Get Your Time Back",
    description: "Connect systems and reduce repetitive administrative work.",
    accentClass: "bg-brand-accent-light border-gray-200 text-brand-secondary",
    iconId: "gears",
  },
  {
    id: "measure",
    dimensionLabel: "MEASUREMENT",
    primaryLabel: "Measure and Improve",
    description: "Use reporting and reviews to improve the next decision.",
    accentClass: "bg-brand-secondary/5 border-brand-secondary/20 text-brand-secondary",
    iconId: "chart",
  },
] as const;

export const CUSTOMER_JOURNEY_HEADLINE =
  "Six stages. One connected system moves a customer through all of them.";

export const CUSTOMER_JOURNEY_ARIA_LABEL =
  "Customer lifecycle for home services: Get Found, Respond Immediately, Convert, Retain and Grow, Get Your Time Back, and Measure and Improve.";
