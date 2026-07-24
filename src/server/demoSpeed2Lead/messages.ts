import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";

function fill(template: string, context: DemoConversationContext): string {
  return template
    .replaceAll("[FIRST NAME]", context.firstName)
    .replaceAll("[BOOKING LINK]", context.bookingUrl);
}

export function initialMessage(context: DemoConversationContext): string {
  return fill(
    `Hey [FIRST NAME], Chris with 624Voice. Thanks for trying the Jessica demo.

What stood out most: how she answered questions, booked the visit, sent the confirmation, or introduced the maintenance plan?`,
    context,
  );
}

export function faqBusinessValueQuestion(context: DemoConversationContext): string {
  return fill(
    "What would be most valuable in your business: answering calls after hours, giving customers consistent information, or reducing the number of routine questions your team handles?",
    context,
  );
}

export function faqAfterHoursProcessQuestion(context: DemoConversationContext): string {
  return fill(
    "Are those calls currently going to voicemail, an answering service, or someone on your team?",
    context,
  );
}

export function faqAfterHoursFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like an opportunity to improve coverage without asking your team to stay available around the clock.

A customized agent could be built around your services, policies, and escalation rules.

Here is my booking link if you would like to spend 25 minutes mapping out what that could look like as part of a broader AI system: [BOOKING LINK]`,
    context,
  );
}

export function faqInconsistentWhereQuestion(context: DemoConversationContext): string {
  return fill(
    "Where do customers get the most inconsistent answers today: pricing, availability, service areas, policies, or something else?",
    context,
  );
}

export function faqInconsistentFollowUp(context: DemoConversationContext): string {
  return fill(
    `That is a good example of where a centralized AI workflow could create a more consistent customer experience.

Here is my booking link if you would like to explore how that information could be managed across calls, texts, and follow-up: [BOOKING LINK]`,
    context,
  );
}

export function faqRoutineQuestionsQuestion(context: DemoConversationContext): string {
  return fill(
    "Which questions take up the most time for your team?",
    context,
  );
}

export function faqRoutineQuestionsFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like a practical place to start because it could create immediate capacity for your team.

You can book a 25-minute AI orchestration consultation here: [BOOKING LINK]`,
    context,
  );
}

export function bookingValueQuestion(context: DemoConversationContext): string {
  return fill(
    "Which part would create the most value for you: capturing requests after hours, reducing scheduling work, or making it easier for customers to book?",
    context,
  );
}

export function bookingAfterHoursTodayQuestion(context: DemoConversationContext): string {
  return fill(
    "What happens today when someone tries to book outside normal business hours?",
    context,
  );
}

export function bookingAfterHoursFollowUp(context: DemoConversationContext): string {
  return fill(
    `That may be where opportunities are slipping through while customers are still actively looking for help.

A broader system could answer the inquiry, collect the right details, guide the next step, and continue the follow-up.

Here is my booking link if you would like to map that out: [BOOKING LINK]`,
    context,
  );
}

export function bookingSchedulingWorkQuestion(context: DemoConversationContext): string {
  return fill(
    "Which part creates the most work today: collecting details, checking availability, confirming appointments, or handling changes?",
    context,
  );
}

export function bookingSchedulingWorkFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a clear workflow to evaluate first.

The consultation would look beyond the call itself and identify how the scheduling, confirmation, and follow-up steps could work together.

You can choose a time here: [BOOKING LINK]`,
    context,
  );
}

export function bookingFrictionQuestion(context: DemoConversationContext): string {
  return fill(
    "Where does the most friction happen today: reaching your team, waiting for a response, finding an available time, or completing the intake process?",
    context,
  );
}

export function bookingFrictionFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like a customer access problem more than a demand problem.

Here is my booking link if you would like to explore how AI could make the path from inquiry to booked appointment easier: [BOOKING LINK]`,
    context,
  );
}

export function confirmationValueQuestion(context: DemoConversationContext): string {
  return fill(
    "What would be more valuable for you: fewer missed appointments, less manual follow-up, or a more professional customer experience?",
    context,
  );
}

export function confirmationHowConfirmedQuestion(context: DemoConversationContext): string {
  return fill(
    "How are appointments currently confirmed and reminded?",
    context,
  );
}

export function confirmationFewerMissedFollowUp(context: DemoConversationContext): string {
  return fill(
    `There may be an opportunity to create a more consistent process before the appointment and reduce avoidable gaps.

You can book a 25-minute consultation here if you would like to map out the full confirmation and reminder workflow: [BOOKING LINK]`,
    context,
  );
}

export function confirmationManualTasksQuestion(context: DemoConversationContext): string {
  return fill(
    "Which follow-up tasks are your team still doing manually?",
    context,
  );
}

export function confirmationManualFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like a good automation opportunity because it is repetitive, measurable, and tied directly to the customer experience.

Here is my booking link if you would like to explore how those steps could work together: [BOOKING LINK]`,
    context,
  );
}

export function confirmationConsistencyWhereQuestion(context: DemoConversationContext): string {
  return fill(
    "Where would you most want the experience to feel more consistent: before the appointment, during scheduling, after booking, or after the service visit?",
    context,
  );
}

export function confirmationProfessionalFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a strong place to begin.

The goal would be to design the customer journey as one connected system instead of a collection of separate messages and tools.

You can choose a time here: [BOOKING LINK]`,
    context,
  );
}

export function maintenanceValueQuestion(context: DemoConversationContext): string {
  return fill(
    "What interested you more: creating recurring revenue, making the offer consistently, or reaching more customers with it?",
    context,
  );
}

export function maintenanceHasPlanQuestion(context: DemoConversationContext): string {
  return fill(
    "Do you currently offer any type of membership, service agreement, or maintenance plan?",
    context,
  );
}

export function maintenancePlanConsistencyQuestion(context: DemoConversationContext): string {
  return fill(
    "How consistently is it presented to eligible customers today?",
    context,
  );
}

export function maintenanceHasPlanFollowUp(context: DemoConversationContext): string {
  return fill(
    `That may be less about creating a new offer and more about building a system that presents the existing offer at the right moments.

Here is my booking link if you would like to map out how voice, text, and follow-up could support recurring revenue: [BOOKING LINK]`,
    context,
  );
}

export function maintenanceNoPlanOpportunityQuestion(context: DemoConversationContext): string {
  return fill(
    "Would the bigger opportunity be creating the offer itself or building a process to introduce it consistently?",
    context,
  );
}

export function maintenanceNoPlanFollowUp(context: DemoConversationContext): string {
  return fill(
    `That could be a valuable part of a broader AI orchestration plan rather than a single voice agent feature.

You can book a 25-minute consultation here: [BOOKING LINK]`,
    context,
  );
}

export function maintenanceOfferTimingQuestion(context: DemoConversationContext): string {
  return fill(
    "When would you want that offer introduced: during the initial call, after booking, after the service visit, or during follow-up?",
    context,
  );
}

export function maintenanceOfferTimingFollowUp(context: DemoConversationContext): string {
  return fill(
    `That is exactly the type of customer journey decision that should be designed intentionally.

Here is my booking link if you would like to map out the right timing and workflow: [BOOKING LINK]`,
    context,
  );
}

export function maintenanceBestFitQuestion(context: DemoConversationContext): string {
  return fill(
    "Which customers would be the best fit for the offer?",
    context,
  );
}

export function maintenanceReachFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a clear audience and outcome to work from.

The next step would be identifying where AI could introduce the offer without making the experience feel forced.

You can choose a time here: [BOOKING LINK]`,
    context,
  );
}

export function multiplePriorityQuestion(context: DemoConversationContext): string {
  return fill(
    "If you could improve only one area first, which would create the bigger impact: capturing more revenue or reducing the workload on your team?",
    context,
  );
}

export function multipleRevenueOpportunityQuestion(context: DemoConversationContext): string {
  return fill(
    "Where do you think the biggest opportunity is today: unanswered inquiries, slow follow-up, unbooked requests, or recurring revenue?",
    context,
  );
}

export function multipleRevenueFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a clear revenue problem to work backward from.

Here is my booking link if you would like to spend 25 minutes mapping out the AI workflows that could address it: [BOOKING LINK]`,
    context,
  );
}

export function multipleWorkloadTaskQuestion(context: DemoConversationContext): string {
  return fill(
    "Which task would you most want taken off your team's plate first?",
    context,
  );
}

export function multipleWorkloadFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like a practical first workflow because the impact should be easy to see and measure.

You can book the AI orchestration consultation here: [BOOKING LINK]`,
    context,
  );
}

export function multipleBothPressureQuestion(context: DemoConversationContext): string {
  return fill(
    "Which is creating more pressure right now: missed opportunities or limited team capacity?",
    context,
  );
}

export function multipleBothFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us the right place to begin.

The consultation can still look at both, but we should start with the problem creating the most immediate impact.

Here is my booking link: [BOOKING LINK]`,
    context,
  );
}

export function notSureRelevanceQuestion(context: DemoConversationContext): string {
  return fill(
    "Which felt more relevant while you were testing Jessica: helping customers get an immediate response or taking repetitive work off your team?",
    context,
  );
}

export function notSureWaitLongestQuestion(context: DemoConversationContext): string {
  return fill(
    "Where do customers wait the longest today?",
    context,
  );
}

export function notSureImmediateFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like the first customer journey gap worth evaluating.

You can book a 25-minute consultation here if you would like to map out how AI could shorten that response time: [BOOKING LINK]`,
    context,
  );
}

export function notSureRepetitiveTaskQuestion(context: DemoConversationContext): string {
  return fill(
    "Which repetitive task would you remove first if you could?",
    context,
  );
}

export function notSureWorkloadFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a useful starting point.

Here is my booking link if you would like to explore how that task could connect with the rest of your customer workflow: [BOOKING LINK]`,
    context,
  );
}

export function notSureFallbackFollowUp(context: DemoConversationContext): string {
  return fill(
    "No problem. The consultation is designed to identify the best starting point based on your current process.\n\nYou can choose a 25-minute time here: [BOOKING LINK]",
    context,
  );
}

export function positiveValueQuestion(context: DemoConversationContext): string {
  return fill(
    "What part felt most valuable for a real business?",
    context,
  );
}

export function positiveFeedbackFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a strong starting point.

Jessica was built for a demo plumbing company, but your version would be designed around your actual workflows and connected to the other parts of your customer journey.

Here is my booking link if you would like to explore that in a 25-minute consultation: [BOOKING LINK]`,
    context,
  );
}

export function negativeWeaknessQuestion(context: DemoConversationContext): string {
  return fill(
    "Fair feedback. What felt weakest or least realistic?",
    context,
  );
}

export function negativeFeedbackFollowUp(context: DemoConversationContext): string {
  return fill(
    `That is useful feedback.

Jessica is configured for a fictional plumbing company, so some of the experience may not match how your business would need to operate.

A customized system would still need to prove it could solve the issue you noticed.

Here is my booking link if you would like to evaluate that together: [BOOKING LINK]`,
    context,
  );
}

export function demoErrorDetailQuestion(context: DemoConversationContext): string {
  return fill(
    "What did Jessica misunderstand or handle incorrectly?",
    context,
  );
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
    "Here is my booking link for a 25-minute consultation: [BOOKING LINK]",
    context,
  );
}

export function faq624VoiceMessage(context: DemoConversationContext): string {
  return fill(
    `624Voice helps home service businesses design and connect AI across the customer journey.

That can include calls, lead response, scheduling, confirmations, follow-up, customer communication, and recurring revenue workflows.

Which part of that would be most valuable for you?`,
    context,
  );
}

export function faq624VoiceFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a clear place to begin.

Here is my booking link if you would like to map out what the broader system could look like: [BOOKING LINK]`,
    context,
  );
}

export function customizationMessage(context: DemoConversationContext): string {
  return fill(
    `The Jessica demo uses a fictional plumbing company.

A custom version would be built around the actual services, policies, service area, availability, scheduling rules, customer questions, and escalation process it needs to follow.

What would you want it to handle first?`,
    context,
  );
}

export function customizationFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like the right first workflow to evaluate.

You can choose a 25-minute time here to map it out: [BOOKING LINK]`,
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
    "That is exactly the type of gap the consultation is designed to uncover.\n\nHere is my booking link: [BOOKING LINK]",
    context,
  );
}

export function priceMessage(context: DemoConversationContext): string {
  return fill(
    `Pricing depends on which workflows need to be built, how much the system needs to handle, and what it needs to connect with.

The first step is identifying where the strongest business case exists.

Here is my booking link for a 25-minute AI orchestration consultation: [BOOKING LINK]`,
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
    `That sounds like a practical first workflow to evaluate.

Here is my booking link if you would like to explore how it could fit around your team: [BOOKING LINK]`,
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
    `That gives us a clear comparison point.

You can book a 25-minute consultation here if you would like to evaluate whether a broader AI system would improve that part of the process: [BOOKING LINK]`,
    context,
  );
}

export function alreadyAiHandlingQuestion(context: DemoConversationContext): string {
  return fill(
    "What is your current AI system handling today?",
    context,
  );
}

export function alreadyAiGapsQuestion(context: DemoConversationContext): string {
  return fill(
    "Where does the process still require manual work or break between tools?",
    context,
  );
}

export function alreadyAiFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like an orchestration issue rather than a need to add another disconnected AI tool.

Here is my booking link if you would like to map out the gaps: [BOOKING LINK]`,
    context,
  );
}

export function readyToBookMessage(context: DemoConversationContext): string {
  return fill(
    "Absolutely. You can choose a 25-minute time here: [BOOKING LINK]",
    context,
  );
}

export function vagueClarificationQuestion(context: DemoConversationContext): string {
  return fill(
    "Just so I point you in the right direction, did the demo feel more valuable for capturing revenue or reducing office workload?",
    context,
  );
}

export function vagueRevenueOpportunityQuestion(context: DemoConversationContext): string {
  return fill(
    "Where do you see the biggest opportunity today: unanswered inquiries, scheduling, customer follow-up, or recurring revenue?",
    context,
  );
}

export function vagueRevenueFollowUp(context: DemoConversationContext): string {
  return fill(
    `That gives us a clear outcome to focus on.

Here is my booking link if you would like to map out the workflows that could support it: [BOOKING LINK]`,
    context,
  );
}

export function vagueWorkloadTaskQuestion(context: DemoConversationContext): string {
  return fill(
    "Which task would you most want taken off your team's plate first?",
    context,
  );
}

export function vagueWorkloadFollowUp(context: DemoConversationContext): string {
  return fill(
    `That sounds like the best first workflow to evaluate.

You can book the 25-minute consultation here: [BOOKING LINK]`,
    context,
  );
}

export function vagueBothPressureQuestion(context: DemoConversationContext): string {
  return fill(
    "Which is creating more pressure right now: opportunities slipping through or your team being stretched too thin?",
    context,
  );
}

export function vagueBothFollowUp(context: DemoConversationContext): string {
  return fill(
    "That gives us the right place to start.\n\nHere is my booking link: [BOOKING LINK]",
    context,
  );
}

export function vagueFallbackFollowUp(context: DemoConversationContext): string {
  return fill(
    "The consultation is designed to identify the highest-value place to start.\n\nYou can choose a 25-minute time here: [BOOKING LINK]",
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
  return fill(
    "Which part?",
    context,
  );
}

export function justTestingYesFollowUp(context: DemoConversationContext): string {
  return fill(
    "That gives us a good starting point if you decide to explore it further.\n\nHere is my booking link for a 25-minute consultation: [BOOKING LINK]",
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
    "That is fair.\n\nI will leave you with my booking link in case that changes: [BOOKING LINK]",
    context,
  );
}

export function declineMessage(): string {
  return "No problem. Thanks for taking the time to try the demo.\n\nI will leave it there.";
}

export function meetingBookedMessage(context: DemoConversationContext): string {
  return fill(
    "Thanks, [FIRST NAME]. I saw your booking come through.\n\nI am looking forward to learning more about your current process and where AI could create the most value.",
    context,
  );
}

export function followUp1Message(context: DemoConversationContext): string {
  return fill(
    `Hey [FIRST NAME], curious what you thought of Jessica.

Did the biggest opportunity feel like answering more customer requests, reducing office workload, or creating more recurring revenue?`,
    context,
  );
}

export function followUp2Message(context: DemoConversationContext): string {
  return fill(
    `Jessica is only a demo for a fictional plumbing company.

The bigger opportunity is building the right AI workflows around how your actual customer journey works.

If you would like to map that out, here is my booking link for a 25-minute consultation: [BOOKING LINK]`,
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
  return "Thanks for your message. If you recently tried the Jessica demo, reply with what stood out most and I can point you in the right direction.";
}

export function repromptFeatureQuestion(context: DemoConversationContext): string {
  return fill(
    "What stood out most: how she answered questions, booked the visit, sent the confirmation, or introduced the maintenance plan?",
    context,
  );
}
