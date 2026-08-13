import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";

function fill(template: string, context: ContactConversationContext): string {
  return template
    .replaceAll("[FIRST NAME]", context.firstName)
    .replaceAll("[BUSINESS NAME]", context.businessName)
    .replaceAll("[SHORT NEED SUMMARY]", context.shortNeedSummary)
    .replaceAll("[RELEVANT SOLUTION]", context.relevantSolution)
    .replaceAll("[RELEVANT LINK]", context.relevantLink)
    .replaceAll("[SHORT RELEVANT EXAMPLE OR DEMO LINK]", context.relevantExample)
    .replaceAll("[RELEVANT EXAMPLE OR RESOURCE]", context.relevantExample)
    .replaceAll(
      "[RESTATE CUSTOMER GOAL IN SIMPLE TERMS]",
      context.lastCustomerMessage ?? context.shortNeedSummary,
    )
    .replaceAll("[BOOKING LINK]", context.bookingUrl);
}

export function initialMessage(context: ContactConversationContext): string {
  return fill(
    `Hey [FIRST NAME], Chris with 624Voice — thanks for reaching out. I saw your message come through. What prompted you to reach out today?`,
    context,
  );
}

export function identityAnswerMessage(context: ContactConversationContext): string {
  return fill(
    "Chris with 624Voice — you reached out through our contact form about [SHORT NEED SUMMARY]. Happy to help however is useful.\n\nWhat prompted you to reach out today?",
    context,
  );
}

export function personalizeQuestion(context: ContactConversationContext): string {
  return fill(
    "Got it. What would you most want to improve first for [BUSINESS NAME]?",
    context,
  );
}

export function missedCallsFollowUpQuestion(context: ContactConversationContext): string {
  return "Got it. What happens with those calls today — voicemail, answering service, or does someone on your team try to pick them up?";
}

export function websiteFollowUpQuestion(context: ContactConversationContext): string {
  return "Absolutely. What's the biggest issue with the site you have today — or do you not have one at all?";
}

export function infoAreaQuestion(context: ContactConversationContext): string {
  return "Of course. Are you mainly looking at the website side or the AI/customer-response side?";
}

export function calendarMessage(context: ContactConversationContext): string {
  return fill(
    "Makes sense. That's easier to talk through than go back and forth over text. I can show you how I'd handle it for [BUSINESS NAME]. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function urgentAfterHoursCalendarMessage(context: ContactConversationContext): string {
  return fill(
    "Absolutely. That's one of the primary workflows we build. Rather than make you explain everything over text, let's look at how you'd want after-hours calls handled for [BUSINESS NAME]. Here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function websiteCalendarMessage(context: ContactConversationContext): string {
  return fill(
    "Got it. I can show you what I'd recommend and a few ways we could approach it. Grab whatever time works best here: [BOOKING LINK]",
    context,
  );
}

export function infoCalendarMessage(context: ContactConversationContext): string {
  return fill(
    "If you want to see how that would apply specifically to [BUSINESS NAME], here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function scheduleYesMessage(context: ContactConversationContext): string {
  return fill(
    "Great. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function faqMessage(context: ContactConversationContext): string {
  return fill(
    "We build AI agents for home service businesses that respond to leads, answer customer calls, handle common questions, and help schedule jobs. We also build websites for home service companies that need a stronger online presence.\n\nThat's easier to show you than explain over text. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function faqVoiceBrief(context: ContactConversationContext): string {
  return fill(
    "624Voice AI agents can handle new leads, inbound calls, scheduling, follow-up, and common customer questions — built around how your business actually operates.\n\nIf you want to see how that would apply specifically to [BUSINESS NAME], here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function faqWebsiteBrief(context: ContactConversationContext): string {
  return fill(
    "We build websites for home service businesses focused on getting more leads and presenting your work professionally — not just a better-looking brochure.\n\nIf you want to talk through what that would look like for [BUSINESS NAME], here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function priceMessage(context: ContactConversationContext): string {
  return fill(
    "Pricing depends on what you want us to build and how much you want it to handle.\n\nBased on your form, it sounds like you are mainly looking for help with [SHORT NEED SUMMARY]. Here's my calendar if you'd like to review the options: [BOOKING LINK]",
    context,
  );
}

export function requestInfoMessage(context: ContactConversationContext): string {
  return fill(
    "Absolutely. Based on what you submitted, the most relevant information would be about [RELEVANT SOLUTION].\n\nYou can learn more here: [RELEVANT LINK]\n\nWould you like me to also send a quick example of how that could work for a business like yours?",
    context,
  );
}

export function requestInfoFollowUp(context: ContactConversationContext): string {
  return fill(
    "Here is a quick example: [SHORT RELEVANT EXAMPLE OR DEMO LINK]\n\nIf it looks relevant, here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function notReadyMessage(context: ContactConversationContext): string {
  return fill(
    "No problem. A lot of owners reach out while they are still figuring out what would make the biggest difference.\n\nWould it be helpful if I sent you one quick example related to [SHORT NEED SUMMARY] without asking you to schedule anything?",
    context,
  );
}

export function notReadyFollowUp(context: ContactConversationContext): string {
  return fill(
    "Here you go: [RELEVANT EXAMPLE OR RESOURCE]\n\nYou can keep it for reference, and here's my calendar if you decide you want to explore it later: [BOOKING LINK]",
    context,
  );
}

export function answeringServiceQuestion(context: ContactConversationContext): string {
  return fill(
    "This may not be about replacing your answering service.\n\nWhere do you still see the most room for improvement: response speed, after-hours coverage, lead follow-up, scheduling, or the quality of the customer experience?",
    context,
  );
}

export function answeringServiceFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks, that distinction matters. We can focus on whether an AI agent would improve that part of the process instead of replacing what is already working.\n\nHere's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function officeStaffQuestion(context: ContactConversationContext): string {
  return fill(
    "The goal would not necessarily be to replace your team. It may be to remove repetitive work, extend coverage, and help them respond faster.\n\nWhich task would you most want taken off their plate?",
    context,
  );
}

export function officeStaffFollowUp(context: ContactConversationContext): string {
  return fill(
    "That sounds like the right place to evaluate first.\n\nHere's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function declineMessage(): string {
  return "No problem. I will leave it there, and you can reach out if anything changes.\n\nReply STOP if you do not want to receive additional texts.";
}

export function unknownInboundMessage(): string {
  return "Thanks for your message. If you recently submitted the contact form, tell me what prompted you to reach out and I can point you in the right direction.";
}
