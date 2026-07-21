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
    `Hey [FIRST NAME], Chris with 624Voice. I just received your request about [SHORT NEED SUMMARY] for [BUSINESS NAME].

What would be most helpful right now: booking more jobs, reducing the workload on your office team, improving how customer calls are handled, or something else?`,
    context,
  );
}

export function bookingSubgoalMessage(context: ContactConversationContext): string {
  return fill(
    "Where do you see the biggest opportunity right now: answering more calls, responding to new leads faster, or following up more consistently?",
    context,
  );
}

export function bookingCallsWindowMessage(context: ContactConversationContext): string {
  return fill(
    "Are those calls most often being missed during business hours, after hours, or both?",
    context,
  );
}

export function bookingCallsWindowFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks, that gives me a clearer picture. Improving coverage during that time could help [BUSINESS NAME] capture more opportunities without increasing ad spend.\n\nHere is my calendar if you would like to walk through what that could look like: [BOOKING LINK]",
    context,
  );
}

export function bookingResponseSpeedQuestion(context: ContactConversationContext): string {
  return fill(
    "How quickly is your team usually able to respond when a new lead comes in?",
    context,
  );
}

export function bookingResponseSpeedFollowUp(context: ContactConversationContext): string {
  return fill(
    "Helpful. A faster response process could give you a better chance of reaching customers while they are still actively looking for help.\n\nYou can choose a time here if you would like to see how that could work for [BUSINESS NAME]: [BOOKING LINK]",
    context,
  );
}

export function bookingFollowUpQuestion(context: ContactConversationContext): string {
  return fill(
    "How is follow-up handled today when a new lead does not answer or book right away?",
    context,
  );
}

export function bookingFollowUpFollowUp(context: ContactConversationContext): string {
  return fill(
    "That explains the gap. A consistent follow-up process could help you recover more value from leads you are already paying to generate.\n\nHere is my calendar if you would like to review what that process could look like: [BOOKING LINK]",
    context,
  );
}

export function staffTaskQuestion(context: ContactConversationContext): string {
  return fill(
    "What takes up the most time right now: answering calls, scheduling jobs, following up with leads, or handling repetitive customer questions?",
    context,
  );
}

export function staffTimeQuestion(context: ContactConversationContext): string {
  return fill(
    "About how much time would you estimate your team spends handling that in a typical week?",
    context,
  );
}

export function staffTimeFollowUp(context: ContactConversationContext): string {
  return fill(
    "That is useful context. The goal would be to reduce that workload while still giving customers a fast and professional response.\n\nYou can book a quick walkthrough here if you would like to see which parts of that process could be automated: [BOOKING LINK]",
    context,
  );
}

export function callsImprovementQuestion(context: ContactConversationContext): string {
  return fill(
    "What would you most like to improve: fewer missed calls, better after-hours coverage, more consistent answers, or easier scheduling?",
    context,
  );
}

export function callsFewerMissedQuestion(context: ContactConversationContext): string {
  return fill(
    "When are calls most likely to go unanswered: during busy periods, after hours, or when your team is already helping another customer?",
    context,
  );
}

export function callsFewerMissedFollowUp(context: ContactConversationContext): string {
  return fill(
    "Understood. That sounds like a coverage issue more than a lead generation issue.\n\nHere is my calendar if you would like to see how an AI agent could help cover those calls: [BOOKING LINK]",
    context,
  );
}

export function callsAfterHoursQuestion(context: ContactConversationContext): string {
  return fill(
    "What would you want customers to be able to do after hours: get questions answered, request service, schedule an appointment, or all three?",
    context,
  );
}

export function callsAfterHoursFollowUp(context: ContactConversationContext): string {
  return fill(
    "That gives me a good idea of the experience you are looking for.\n\nYou can choose a time here if you would like to see what an after-hours setup could look like for [BUSINESS NAME]: [BOOKING LINK]",
    context,
  );
}

export function callsConsistentAnswersQuestion(context: ContactConversationContext): string {
  return fill(
    "Which questions does your team have to answer most often?",
    context,
  );
}

export function callsConsistentAnswersFollowUp(context: ContactConversationContext): string {
  return fill(
    "That sounds like a strong use case for automation. The agent could handle those common questions consistently and bring your team in when a person is actually needed.\n\nHere is my calendar if you would like to walk through it: [BOOKING LINK]",
    context,
  );
}

export function callsEasierSchedulingQuestion(context: ContactConversationContext): string {
  return fill(
    "What is creating the most friction today: checking availability, collecting customer details, confirming appointments, or rescheduling?",
    context,
  );
}

export function callsEasierSchedulingFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks, that narrows it down. The best place to start would be the part of the process causing the most delay for your team and customers.\n\nYou can book a quick walkthrough here: [BOOKING LINK]",
    context,
  );
}

export function bothPriorityQuestion(context: ContactConversationContext): string {
  return fill(
    "If you could improve only one first, which would create the biggest immediate impact: bringing in more booked revenue or freeing up your team's time?",
    context,
  );
}

export function bothRevenueSlippageQuestion(context: ContactConversationContext): string {
  return fill(
    "Where are opportunities most likely slipping through today: unanswered calls, slow responses, or inconsistent follow-up?",
    context,
  );
}

export function bothRevenueFollowUp(context: ContactConversationContext): string {
  return fill(
    "That is where I would start because it gives you the clearest path to measuring revenue impact.\n\nHere is my calendar if you would like to map out what that could look like: [BOOKING LINK]",
    context,
  );
}

export function bothTimeTaskQuestion(context: ContactConversationContext): string {
  return fill(
    "Which task would you most want taken off your team's plate first: calls, scheduling, lead follow-up, or repetitive questions?",
    context,
  );
}

export function bothTimeFollowUp(context: ContactConversationContext): string {
  return fill(
    "That sounds like the most practical place to begin.\n\nYou can choose a time here if you would like to see how that process could be automated: [BOOKING LINK]",
    context,
  );
}

export function somethingElseQuestion(context: ContactConversationContext): string {
  return fill("Sure. What would you like to improve or fix?", context);
}

export function somethingElseFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks for explaining. It sounds like the main goal is [RESTATE CUSTOMER GOAL IN SIMPLE TERMS].\n\nHere is my calendar if you would like to spend 15 minutes looking at whether 624Voice could help with that: [BOOKING LINK]",
    context,
  );
}

export function faqMessage(context: ContactConversationContext): string {
  return fill(
    "We build AI agents for home service businesses that respond to leads, answer customer calls, handle common questions, and help schedule jobs.\n\nWe also build websites for home service companies that need a stronger online presence.\n\nWhich part are you most interested in?",
    context,
  );
}

export function faqVoiceQuestion(context: ContactConversationContext): string {
  return fill(
    "What would you want the agent to handle first: new leads, inbound calls, scheduling, follow-up, or customer questions?",
    context,
  );
}

export function faqVoiceFollowUp(context: ContactConversationContext): string {
  return fill(
    "That gives me a good starting point.\n\nHere is my calendar if you would like to see what that setup could look like for [BUSINESS NAME]: [BOOKING LINK]",
    context,
  );
}

export function faqWebsiteQuestion(context: ContactConversationContext): string {
  return fill(
    "What is the main goal for the website: getting more leads, looking more professional, showing your work, or replacing a site that is not performing?",
    context,
  );
}

export function faqWebsiteFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks, that helps. The website should be built around that outcome instead of just giving you a better-looking online brochure.\n\nHere is my calendar if you would like to talk through the project: [BOOKING LINK]",
    context,
  );
}

export function priceMessage(context: ContactConversationContext): string {
  return fill(
    "Pricing depends on what you want us to build and how much you want it to handle.\n\nBased on your form, it sounds like you are mainly looking for help with [SHORT NEED SUMMARY].\n\nHere is my calendar if you would like to review the options and pricing: [BOOKING LINK]",
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
    "Here is a quick example: [SHORT RELEVANT EXAMPLE OR DEMO LINK]\n\nIf it looks relevant, you can choose a time here to talk through it: [BOOKING LINK]",
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
    "Here you go: [RELEVANT EXAMPLE OR RESOURCE]\n\nYou can keep it for reference, and here is my calendar if you decide you want to explore it later: [BOOKING LINK]",
    context,
  );
}

export function scheduleYesMessage(context: ContactConversationContext): string {
  return fill(
    "Great. You can choose whatever time works best here: [BOOKING LINK]\n\nOnce you book, you will receive a confirmation with the details.",
    context,
  );
}

export function vagueClarificationMessage(context: ContactConversationContext): string {
  return fill(
    "Just so I point you in the right direction, which is the bigger priority right now: booking more jobs, reducing office workload, or improving how customer calls are handled?",
    context,
  );
}

export function vagueBookingSubgoalMessage(context: ContactConversationContext): string {
  return fill(
    "Where do you see the biggest opportunity: answering more calls, responding faster, or following up more consistently?",
    context,
  );
}

export function vagueBookingFollowUp(context: ContactConversationContext): string {
  return fill(
    "Thanks, that tells me where to focus.\n\nHere is my calendar if you would like to see what improving that process could look like: [BOOKING LINK]",
    context,
  );
}

export function vagueStaffTaskQuestion(context: ContactConversationContext): string {
  return fill(
    "What takes up the most time today: calls, scheduling, follow-up, or repetitive customer questions?",
    context,
  );
}

export function vagueStaffFollowUp(context: ContactConversationContext): string {
  return fill(
    "That gives me a good starting point.\n\nYou can choose a time here if you would like to see how that process could be automated: [BOOKING LINK]",
    context,
  );
}

export function vagueCallsImprovementQuestion(context: ContactConversationContext): string {
  return fill(
    "What would you most like to improve: fewer missed calls, better after-hours coverage, more consistent answers, or easier scheduling?",
    context,
  );
}

export function vagueCallsFollowUp(context: ContactConversationContext): string {
  return fill(
    "Understood. That is the area I would focus on first.\n\nHere is my calendar if you would like to walk through it: [BOOKING LINK]",
    context,
  );
}

export function vagueFallbackFollowUp(context: ContactConversationContext): string {
  return fill(
    "No problem. Your form gives me enough context to identify a few good starting points.\n\nHere is my calendar if you would like to spend 15 minutes narrowing down the best one: [BOOKING LINK]",
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
    "Thanks, that distinction matters. We can focus on whether an AI agent would improve that part of the process instead of replacing what is already working.\n\nHere is my calendar if you would like to compare the two approaches: [BOOKING LINK]",
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
    "That sounds like the right place to evaluate first.\n\nYou can book a quick walkthrough here if you would like to see what that could look like: [BOOKING LINK]",
    context,
  );
}

export function declineMessage(): string {
  return "No problem. I will leave it there, and you can reach out if anything changes.\n\nReply STOP if you do not want to receive additional texts.";
}

export function unknownInboundMessage(): string {
  return "Thanks for your message. If you recently submitted the contact form, reply with booking more jobs, reducing office workload, improving customer calls, or something else and I can point you in the right direction.";
}
