import type { ConversationContext } from "~/server/speed2Lead/types";

function fill(template: string, context: ConversationContext): string {
  return template
    .replaceAll("[FIRST NAME]", context.firstName)
    .replaceAll("[BUSINESS NAME]", context.businessName)
    .replaceAll("[ANNUAL OPPORTUNITY]", context.annualOpportunity)
    .replaceAll("[PRIMARY OPPORTUNITY FROM REPORT]", context.primaryOpportunity)
    .replaceAll("[BOOKING LINK]", context.bookingUrl)
    .replaceAll("[REPORT LINK]", context.reportUrl);
}

export function initialMessage(context: ConversationContext): string {
  return fill(
    `Hey [FIRST NAME], Chris with 624Voice. I just reviewed your ROI report for [BUSINESS NAME].

Based on the information you entered, you have an opportunity to capture approximately [ANNUAL OPPORTUNITY] in additional annual revenue from the leads you are already generating.

Is your bigger goal right now booking more jobs, growing without adding more office staff, or both?`,
    context,
  );
}

export function bookingSubgoalMessage(context: ConversationContext): string {
  return fill(
    "Where do you see the biggest opportunity right now: answering more calls, responding to new leads faster, or following up more consistently?",
    context,
  );
}

export function bookingCallsWindowMessage(context: ConversationContext): string {
  return fill(
    "Understood. Are those calls most often being missed during business hours, after hours, or both?",
    context,
  );
}

export function bookingCallsWindowFollowUp(context: ConversationContext): string {
  return fill(
    "That helps. Based on your report, improving coverage in that window could have a meaningful impact on the [ANNUAL OPPORTUNITY] identified.\n\nHere is my calendar if you would like to walk through what that could look like for [BUSINESS NAME]: [BOOKING LINK]",
    context,
  );
}

export function bookingResponseSpeedQuestion(context: ConversationContext): string {
  return fill(
    "How quickly is your team usually able to respond when a new lead comes in?",
    context,
  );
}

export function bookingResponseSpeedFollowUp(context: ConversationContext): string {
  return fill(
    "Thanks. Speed is often where the first opportunity shows up because the value of a lead drops quickly when the customer is still calling other companies.\n\nYou can grab a time here if you would like to review the numbers and see what faster response could look like for [BUSINESS NAME]: [BOOKING LINK]",
    context,
  );
}

export function bookingFollowUpQuestion(context: ConversationContext): string {
  return fill(
    "How is follow-up handled today when a new lead does not answer or book right away?",
    context,
  );
}

export function bookingFollowUpFollowUp(context: ConversationContext): string {
  return fill(
    "That gives me a clearer picture. A consistent follow-up process could help you recover more value from leads you have already paid to generate.\n\nHere is my calendar if you would like to walk through the opportunity in your report: [BOOKING LINK]",
    context,
  );
}

export function staffPressureQuestion(context: ConversationContext): string {
  return fill(
    "What is putting the most pressure on your team right now: answering calls, scheduling jobs, following up with leads, or handling repetitive customer questions?",
    context,
  );
}

export function staffTimeQuestion(context: ConversationContext): string {
  return fill(
    "About how much time would you estimate your team spends handling that in a typical week?",
    context,
  );
}

export function staffTimeFollowUp(context: ConversationContext): string {
  return fill(
    "That is useful context. The goal would be to reduce that workload while still giving customers a fast and professional response.\n\nYou can choose a time here if you would like to see which parts of that process could be handled by an AI agent: [BOOKING LINK]",
    context,
  );
}

export function bothPriorityQuestion(context: ConversationContext): string {
  return fill(
    "If you could improve only one first, which would create the bigger immediate impact: booking more revenue or freeing up your team's time?",
    context,
  );
}

export function bothRevenueSubgoalQuestion(context: ConversationContext): string {
  return fill(
    "Where do you see the biggest opportunity right now: answering more calls, responding faster, or following up more consistently?",
    context,
  );
}

export function bothRevenueFollowUp(context: ConversationContext): string {
  return fill(
    "Helpful. I would start there because it gives you the clearest path to measuring revenue impact first.\n\nHere is my calendar if you would like to review the [ANNUAL OPPORTUNITY] and map out what that could look like: [BOOKING LINK]",
    context,
  );
}

export function bothTimeTaskQuestion(context: ConversationContext): string {
  return fill(
    "What takes up the most office time today: calls, scheduling, lead follow-up, or repetitive customer questions?",
    context,
  );
}

export function bothTimeFollowUp(context: ConversationContext): string {
  return fill(
    "Understood. That sounds like the strongest place to begin if the priority is creating capacity without adding another employee.\n\nYou can book a quick walkthrough here: [BOOKING LINK]",
    context,
  );
}

export function notSureQuestion(context: ConversationContext): string {
  return fill(
    "Which is more frustrating today: knowing potential jobs may be slipping away or feeling like your team is already stretched too thin?",
    context,
  );
}

export function notSureFollowUp(context: ConversationContext): string {
  return fill(
    "That gives us a good place to start.\n\nHere is my calendar if you would like to review the report and identify the highest-value opportunity: [BOOKING LINK]",
    context,
  );
}

export function faqMessage(context: ConversationContext): string {
  return fill(
    "We build AI agents for home service businesses that respond to leads immediately, answer customer calls, handle common questions, qualify opportunities, and help book jobs.\n\nThe goal is to help you capture more revenue and reduce office workload without adding the same amount of staff.\n\nWhich part would be more valuable for [BUSINESS NAME] right now?",
    context,
  );
}

export function reportLinkMessage(context: ConversationContext): string {
  return fill(
    "Absolutely. You can access your full report here: [REPORT LINK]\n\nOne thing I would pay close attention to is the estimated [ANNUAL OPPORTUNITY] in additional annual revenue. Would you like me to point out the two or three assumptions driving that number?",
    context,
  );
}

export function notReadyMessage(context: ConversationContext): string {
  return fill(
    "No problem. A lot of owners use the calculator first just to understand what their current lead flow may be worth.\n\nWould it be helpful if I sent you a quick summary of the biggest opportunity in your report without asking you to schedule anything?",
    context,
  );
}

export function notReadySummaryMessage(context: ConversationContext): string {
  return fill(
    "The biggest opportunity appears to be [PRIMARY OPPORTUNITY FROM REPORT]. Based on the information you entered, that contributes to an estimated [ANNUAL OPPORTUNITY] in additional annual revenue.\n\nYou can keep the report for reference, and here is my calendar if you decide you want to explore it later: [BOOKING LINK]",
    context,
  );
}

export function scheduleYesMessage(context: ConversationContext): string {
  return fill(
    "Great. You can choose whatever time works best here: [BOOKING LINK]\n\nOnce you book, you will receive a confirmation with the details.",
    context,
  );
}

export function vagueClarificationMessage(context: ConversationContext): string {
  return fill(
    "Just so I point you in the right direction, is booking more jobs or reducing the workload on your office team the bigger priority?",
    context,
  );
}

export function priceMessage(context: ConversationContext): string {
  return fill(
    "Pricing depends on what you want the agent to handle, but your calculator responses already give us a good starting point.\n\nThe best next step is a quick walkthrough so we can compare the cost against the [ANNUAL OPPORTUNITY] in your report. You can choose a time here: [BOOKING LINK]",
    context,
  );
}

export function answeringServiceQuestion(context: ConversationContext): string {
  return fill(
    "This may not be about replacing your answering service.\n\nWhere do you still see the most room for improvement: response speed, after-hours coverage, lead follow-up, scheduling, or the quality of the customer experience?",
    context,
  );
}

export function answeringServiceFollowUp(context: ConversationContext): string {
  return fill(
    "That distinction is helpful. We can focus specifically on whether an AI agent would improve that part of the process rather than replacing what is already working.\n\nHere is my calendar if you would like to compare the two approaches: [BOOKING LINK]",
    context,
  );
}

export function officeStaffQuestion(context: ConversationContext): string {
  return fill(
    "The goal would not necessarily be to replace your team. It may be to remove repetitive work, extend coverage, and help them respond faster.\n\nWhich task would you most want taken off their plate?",
    context,
  );
}

export function officeStaffFollowUp(context: ConversationContext): string {
  return fill(
    "That sounds like a practical place to evaluate first.\n\nYou can book a quick walkthrough here if you would like to see what that could look like: [BOOKING LINK]",
    context,
  );
}

export function declineMessage(): string {
  return "No problem. I will leave you with the report, and you can reach out if the numbers raise any questions.\n\nReply STOP if you do not want to receive additional texts.";
}

export function optOutConfirmationMessage(): string {
  return "You have been unsubscribed and will not receive additional texts from 624 Voice.";
}

export function unknownInboundMessage(): string {
  return "Thanks for your message. If you downloaded your ROI report recently, reply with booking more jobs, growing without adding staff, or both and I can point you in the right direction.";
}
