import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";

function fill(template: string, context: DemoConversationContext): string {
  const businessName = context.businessName ?? "your business";
  return template
    .replaceAll("[FIRST NAME]", context.firstName)
    .replaceAll("[BUSINESS NAME]", businessName)
    .replaceAll("[BOOKING LINK]", context.bookingUrl);
}

export function identityAnswerMessage(context: DemoConversationContext): string {
  return fill(
    "Chris with 624Voice — you just tried the Jessica demo on 624voice.com. Happy to help however is useful.\n\nCould you actually see something like that working inside [BUSINESS NAME]?",
    context,
  );
}

export function initialMessage(context: DemoConversationContext): string {
  return fill(
    `Hey [FIRST NAME], Chris with 624Voice. I saw you just tried Jessica. Curious — could you actually see something like that working inside [BUSINESS NAME]?`,
    context,
  );
}

export function workloadQuestion(context: DemoConversationContext): string {
  return "What would you want her to take off your team's plate first?";
}

export function calendarMessage(context: DemoConversationContext): string {
  return fill(
    "That's exactly the kind of workflow we build around. I can show you what that would look like inside [BUSINESS NAME] — here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function strongPositiveCalendarMessage(context: DemoConversationContext): string {
  return fill(
    "Glad you liked it. The demo is pretty generic compared with what we'd build around your actual workflow. I can show you what that would look like for [BUSINESS NAME] — grab whatever time works best here: [BOOKING LINK]",
    context,
  );
}

export function shortMeetingReadyMessage(context: DemoConversationContext): string {
  return fill(
    "Absolutely. Here's my calendar — grab whatever time works best: [BOOKING LINK]",
    context,
  );
}

export function objectionQuestion(context: DemoConversationContext): string {
  return "Totally fair. What's the biggest reason you don't think it would work for your business?";
}

export function objectionResolvedCalendarMessage(context: DemoConversationContext): string {
  return fill(
    "That makes sense. That's something we customize around each business rather than using the demo workflow exactly as-is. If you'd like to see what it would look like built around your process, here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function objectionAcknowledgeOnly(context: DemoConversationContext): string {
  return fill(
    "That's fair feedback. Thanks for trying the demo — I'll leave it there unless something changes.",
    context,
  );
}

export function negativeWeaknessQuestion(context: DemoConversationContext): string {
  return "Fair feedback. What felt weakest or least realistic?";
}

export function negativeFeedbackFollowUp(context: DemoConversationContext): string {
  return fill(
    "That is useful feedback. Jessica is configured for a fictional plumbing company, so some of the experience may not match how your business would need to operate. A customized system would still need to prove it could solve the issue you noticed.\n\nIf you'd like to evaluate that together, here's my calendar: [BOOKING LINK]",
    context,
  );
}

export function demoErrorDetailQuestion(context: DemoConversationContext): string {
  return "What did Jessica misunderstand or handle incorrectly?";
}

export function demoErrorUsefulQuestion(context: DemoConversationContext): string {
  return fill(
    `Thanks for pointing that out.

The demo uses sample services, policies, availability, and scheduling rules for a fictional plumbing company.

A production system would be built around the actual business rules it needs to follow.

Would it be useful to look at what that would require for your workflow?`,
    context,
  );
}

export function demoErrorUsefulYesFollowUp(context: DemoConversationContext): string {
  return fill(
    "Here's my calendar for a 25-minute consultation: [BOOKING LINK]",
    context,
  );
}

export function faq624VoiceMessage(context: DemoConversationContext): string {
  return fill(
    `624Voice helps home service businesses design and connect AI across the customer journey.

That can include calls, lead response, scheduling, confirmations, follow-up, customer communication, and recurring revenue workflows.

That's easier to show you than explain over text. Here's my calendar: [BOOKING LINK]`,
    context,
  );
}

export function customizationMessage(context: DemoConversationContext): string {
  return fill(
    `The Jessica demo uses a fictional plumbing company.

A custom version would be built around your actual services, policies, service area, availability, scheduling rules, customer questions, and escalation process.

What would you want it to handle first?`,
    context,
  );
}

export function customizationFollowUp(context: DemoConversationContext): string {
  return fill(
    "That sounds like the right first workflow to evaluate.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function orchestrationMessage(context: DemoConversationContext): string {
  return fill(
    `AI orchestration means connecting the individual AI interactions into one coordinated customer journey.

Instead of only answering a call, the system could help move the customer from inquiry to qualification, scheduling, confirmation, follow-up, and the next best action.

Which part of your current process feels the most disconnected?`,
    context,
  );
}

export function orchestrationFollowUp(context: DemoConversationContext): string {
  return fill(
    "That is exactly the type of gap the consultation is designed to uncover.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function priceMessage(context: DemoConversationContext): string {
  return fill(
    `Pricing depends on which workflows need to be built, how much the system needs to handle, and what it needs to connect with.

The first step is identifying where the strongest business case exists.

Here's my calendar for a 25-minute AI orchestration consultation: [BOOKING LINK]`,
    context,
  );
}

export function officeStaffQuestion(context: DemoConversationContext): string {
  return fill(
    "The goal would not automatically be to replace your staff.\n\nIt could give them better coverage, remove repetitive work, and help customers get immediate answers when the team is unavailable.\n\nWhich task would you most want taken off their plate?",
    context,
  );
}

export function officeStaffFollowUp(context: DemoConversationContext): string {
  return fill(
    "That sounds like a practical first workflow to evaluate.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function answeringServiceQuestion(context: DemoConversationContext): string {
  return fill(
    `This may not be about replacing the answering service.

The question is whether you want a system that can do more than take a message, such as answer questions, collect the right details, support scheduling, send confirmations, and trigger follow-up.

Where does your current service fall short?`,
    context,
  );
}

export function answeringServiceFollowUp(context: DemoConversationContext): string {
  return fill(
    "That gives us a clear comparison point.\n\nHere's my calendar if you'd like to evaluate whether a broader AI system would improve that part of the process: [BOOKING LINK]",
    context,
  );
}

export function alreadyAiHandlingQuestion(context: DemoConversationContext): string {
  return "What is your current AI system handling today?";
}

export function alreadyAiGapsQuestion(context: DemoConversationContext): string {
  return "Where does the process still require manual work or break between tools?";
}

export function alreadyAiFollowUp(context: DemoConversationContext): string {
  return fill(
    "That sounds like an orchestration issue rather than a need to add another disconnected AI tool.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function vagueClarificationQuestion(context: DemoConversationContext): string {
  return "Just so I point you in the right direction — could you see something like Jessica working in your business, or not really?";
}

export function vagueFallbackCalendarMessage(context: DemoConversationContext): string {
  return fill(
    "The consultation is designed to identify the highest-value place to start.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function justTestingMessage(context: DemoConversationContext): string {
  return fill(
    "No problem. That is what the demo is for.\n\nWas there anything Jessica handled that you could see being useful in a real business?",
    context,
  );
}

export function justTestingPartQuestion(context: DemoConversationContext): string {
  return "Which part?";
}

export function justTestingYesFollowUp(context: DemoConversationContext): string {
  return fill(
    "That gives us a good starting point if you decide to explore it further.\n\nHere's my calendar: [BOOKING LINK]",
    context,
  );
}

export function justTestingNoMessage(context: DemoConversationContext): string {
  return fill(
    "Thanks for trying it. I will leave it there.",
    context,
  );
}

export function notReadyMessage(context: DemoConversationContext): string {
  return fill(
    "No problem. What would need to be true for this to become worth exploring?",
    context,
  );
}

export function notReadyFollowUp(context: DemoConversationContext): string {
  return fill(
    "That is fair.\n\nI'll leave you with my booking link in case that changes: [BOOKING LINK]",
    context,
  );
}

export function declineMessage(): string {
  return "No problem. Thanks for taking the time to try the demo.\n\nI will leave it there.";
}

export function meetingBookedMessage(context: DemoConversationContext): string {
  return fill(
    "Thanks, [FIRST NAME]. I'll confirm the details once your booking comes through.",
    context,
  );
}

export function followUp1Message(context: DemoConversationContext): string {
  return fill(
    `Hey [FIRST NAME], curious what you thought of Jessica.

Could you actually see something like that working in your business?`,
    context,
  );
}

export function followUp2Message(context: DemoConversationContext): string {
  return fill(
    `Jessica is only a demo for a fictional plumbing company.

The bigger opportunity is building the right AI workflows around how your actual customer journey works.

If you would like to map that out, here's my calendar: [BOOKING LINK]`,
    context,
  );
}

export function followUp3Message(context: DemoConversationContext): string {
  return fill(
    `I will close the loop for now.

If improving lead response, customer communication, scheduling, or office capacity becomes a priority, you can choose a time here: [BOOKING LINK]

Reply STOP to opt out.`,
    context,
  );
}

export function unknownInboundMessage(): string {
  return "Thanks for your message. If you recently tried the Jessica demo, tell me whether you could see it working in your business and I can point you in the right direction.";
}
