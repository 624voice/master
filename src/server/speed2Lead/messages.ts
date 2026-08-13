import type { ConversationContext } from "~/server/speed2Lead/types";
import { hasMeaningfulRoiValue } from "~/server/speed2Lead/naturalLanguage";

function fill(template: string, context: ConversationContext): string {
  return template
    .replaceAll("[FIRST NAME]", context.firstName)
    .replaceAll("[BUSINESS NAME]", context.businessName)
    .replaceAll("[ANNUAL OPPORTUNITY]", context.annualOpportunity)
    .replaceAll("[PRIMARY OPPORTUNITY FROM REPORT]", context.primaryOpportunity)
    .replaceAll("[LOST REVENUE]", context.annualOpportunity)
    .replaceAll("[BOOKING LINK]", context.bookingUrl)
    .replaceAll("[REPORT LINK]", context.reportUrl);
}

export function initialMessage(context: ConversationContext): string {
  if (hasMeaningfulRoiValue(context.annualOpportunity)) {
    return fill(
      `Hey [FIRST NAME], Chris with 624Voice. I just sent your ROI report. The number that jumped out at me was the estimated [LOST REVENUE] in missed revenue. I can walk you through where that number is coming from and the fastest way I'd attack it for [BUSINESS NAME]. Here's my calendar: [BOOKING LINK]`,
      context,
    );
  }

  return fill(
    `Hey [FIRST NAME], Chris with 624Voice. I just sent your ROI report over. Curious — where do you think you're losing the most opportunities today: missed calls, slow response to new leads, or follow-up?`,
    context,
  );
}

export function usesDirectOpening(context: ConversationContext): boolean {
  return hasMeaningfulRoiValue(context.annualOpportunity);
}

export function priorityQuestion(context: ConversationContext): string {
  return "Got it. How much of a priority is fixing that for you right now?";
}

export function calendarMessage(context: ConversationContext): string {
  return fill(
    "Makes sense. I can show you what I'd change and what that could look like for [BUSINESS NAME]. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function urgentCalendarMessage(context: ConversationContext): string {
  return fill(
    "Absolutely. I can show you how I'd approach that for [BUSINESS NAME]. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function clarifyProblemQuestion(context: ConversationContext): string {
  return fill(
    "Got it. Are missed calls, slow lead response, or follow-up the bigger issue for [BUSINESS NAME] right now?",
    context,
  );
}

export function faqMessage(context: ConversationContext): string {
  return fill(
    "We build AI agents for home service businesses that respond to leads immediately, answer customer calls, handle common questions, qualify opportunities, and help book jobs.\n\nThe goal is to help you capture more revenue and reduce office workload without adding the same amount of staff.\n\nThat's easier to show you than explain over text. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function reportLinkMessage(context: ConversationContext): string {
  return fill(
    "Absolutely. You can access your full report here: [REPORT LINK]\n\nIf you want to walk through the numbers together, here's my calendar: [BOOKING LINK]",
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
    "The biggest opportunity appears to be [PRIMARY OPPORTUNITY FROM REPORT]. Based on the information you entered, that contributes to an estimated [ANNUAL OPPORTUNITY] in additional annual revenue.\n\nYou can keep the report for reference, and here's my calendar if you decide you want to explore it later: [BOOKING LINK]",
    context,
  );
}

export function scheduleYesMessage(context: ConversationContext): string {
  return fill(
    "Great. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function priceMessage(context: ConversationContext): string {
  return fill(
    "Pricing depends on what you want the agent to handle, but your calculator responses already give us a good starting point.\n\nThe best next step is a quick walkthrough so we can compare the cost against the [ANNUAL OPPORTUNITY] in your report. Here's my calendar: [BOOKING LINK]",
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
    "That distinction is helpful. We can focus specifically on whether an AI agent would improve that part of the process rather than replacing what is already working.\n\nHere's my calendar — grab whatever time works best: [BOOKING LINK]",
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
    "That sounds like a practical place to evaluate first.\n\nHere's my calendar — grab whatever time works best: [BOOKING LINK]",
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
  return "Thanks for your message. If you downloaded your ROI report recently, tell me where you're losing opportunities and I can point you in the right direction.";
}
