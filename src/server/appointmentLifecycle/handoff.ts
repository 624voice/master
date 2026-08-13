import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import type { LeadIndexEntry, S2LSource } from "~/server/appointmentLifecycle/types";
import { getLeadByPhone, saveLeadIndex } from "~/server/appointmentLifecycle/store";
import {
  getSession,
  saveSession,
} from "~/server/speed2Lead/session";
import type { AnyConversationContext, ConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

export async function registerLeadForLifecycle(input: {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  source: S2LSource;
  shortNeedSummary?: string;
}): Promise<void> {
  const entry: LeadIndexEntry = {
    phone: normalizePhone(input.phone),
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    source: input.source,
    shortNeedSummary: input.shortNeedSummary,
    registeredAt: new Date().toISOString(),
  };
  await saveLeadIndex(entry);
}

export async function markSpeed2LeadBooked(phone: string): Promise<void> {
  const session = await getSession(phone);
  if (!session) {
    return;
  }

  const now = new Date().toISOString();
  let updated: AnyConversationContext;

  if (session.flow === "demo") {
    updated = {
      ...session,
      meetingBooked: true,
      state: "completed",
      nextFollowUpAt: undefined,
      updatedAt: now,
    } satisfies DemoConversationContext;
    await removeDemoFollowUp(phone);
  } else if (session.flow === "contact") {
    updated = {
      ...session,
      state: "completed",
      updatedAt: now,
    } satisfies ContactConversationContext;
  } else {
    updated = {
      ...session,
      state: "completed",
      updatedAt: now,
    } satisfies ConversationContext;
  }

  await saveSession(updated);
  logAppointmentEvent("lifecycle_handoff", { phone, flow: session.flow ?? "roi" });
}

export async function suppressSalesFollowUps(phone: string): Promise<void> {
  await removeDemoFollowUp(phone);
  await markSpeed2LeadBooked(phone);
}

export async function markSelfReportedAndAcknowledge(
  phone: string,
): Promise<{ selfReported: boolean }> {
  const entry = await getLeadByPhone(phone);
  if (!entry) {
    return { selfReported: false };
  }

  await saveLeadIndex({
    ...entry,
    selfReportedBookingAt: new Date().toISOString(),
  });
  await suppressSalesFollowUps(phone);
  return { selfReported: true };
}
