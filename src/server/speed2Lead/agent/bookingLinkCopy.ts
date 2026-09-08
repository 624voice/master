import { getBookingCalendarLink } from "~/server/appointmentLifecycle/config";
import { usableGreetingName } from "~/server/speed2Lead/agent/greetingName";
import type { AgentFlow } from "~/server/speed2Lead/agent/state";

export function bookingLinkUrl(): string {
  return getBookingCalendarLink();
}

export function bookingLinkHandoffCopy(flow: AgentFlow, link: string): string {
  if (flow === "contact") {
    return `Great — pick a time that works here: ${link}. I'll confirm once it's booked, and I'm here if you have questions in the meantime.`;
  }
  if (flow === "demo") {
    return `Awesome — grab a time here: ${link}. I'll send the confirmation once it's set, and I'm around if anything else comes up about Jessica before then.`;
  }
  return `Sounds good — grab a time that works here: ${link}. Once you book I'll send the details, and I'm around if anything comes up before then.`;
}

export function bookingLinkResendCopy(link: string): string {
  return `Here's that link again: ${link}`;
}

export function bookingLinkFollowUpCopy(
  flow: AgentFlow,
  stageIndex: number,
  firstName: string | undefined,
  link: string,
): string {
  if (stageIndex === 0) {
    const name = usableGreetingName(firstName);
    return name
      ? `Hey ${name} — did you get a chance to grab a time? Here's the link again if you need it: ${link}`
      : `Hey — did you get a chance to grab a time? Here's the link again if you need it: ${link}`;
  }
  if (stageIndex === 1) {
    if (flow === "contact") {
      return `Following up — still happy to go over what you're looking for. Grab a time here whenever works: ${link}`;
    }
    if (flow === "demo") {
      return `Following up on Jessica — still happy to dig into how it'd work for you. Grab a time here whenever works: ${link}`;
    }
    return `Just circling back — still happy to walk through the report with you. Grab a time here whenever works: ${link}`;
  }
  return "I'll close the loop here so I don't keep chasing you. If you want to look at this later, just text me and we can pick it back up.";
}
