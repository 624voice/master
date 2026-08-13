import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  isMeetingCompleted,
  isMeetingDue,
  nextReminderKind,
} from "~/server/appointmentLifecycle/reminderSchedule";
import {
  reminder24hMessage,
  reminder2hMessage,
} from "~/server/appointmentLifecycle/messages";
import { sendLifecycleSms } from "~/server/appointmentLifecycle/sms";
import {
  getLifecycleRecord,
  getReminderIndexEventIds,
  saveLifecycleRecord,
} from "~/server/appointmentLifecycle/store";
import type { AppointmentLifecycleRecord } from "~/server/appointmentLifecycle/types";
import { isOptedOut } from "~/server/speed2Lead/session";

function messageContext(record: AppointmentLifecycleRecord) {
  return {
    firstName: record.firstName ?? "there",
    businessName: record.businessName,
    source: record.source,
    appointmentStart: record.appointmentStart,
    timezone: record.timezone,
    meetingLink: record.meetingLink,
    rescheduleLink: record.rescheduleLink,
  };
}

async function sendReminder(
  record: AppointmentLifecycleRecord,
  kind: "24h" | "2h",
  now: Date,
): Promise<boolean> {
  if (!record.phone) return false;

  if (await isOptedOut(record.phone)) {
    logAppointmentEvent("sms_suppressed_opt_out", {
      phone: record.phone,
      eventId: record.calendarEventId,
      messageType: `${kind}_reminder`,
    });
    return false;
  }

  const ctx = messageContext(record);
  const body = kind === "24h" ? reminder24hMessage(ctx) : reminder2hMessage(ctx);

  await sendLifecycleSms(record.phone, body, {
    messageType: `${kind}_reminder`,
    eventId: record.calendarEventId,
  });

  const updated: AppointmentLifecycleRecord = {
    ...record,
    updatedAt: now.toISOString(),
    lifecycleStatus:
      kind === "24h"
        ? "reminder_24h_sent"
        : record.lifecycleStatus === "reminder_24h_sent"
          ? "reminder_2h_sent"
          : "reminder_2h_sent",
  };

  if (kind === "24h") {
    updated.reminder24hSentAt = now.toISOString();
  } else {
    updated.reminder2hSentAt = now.toISOString();
  }

  await saveLifecycleRecord(updated);
  logAppointmentEvent("reminder_sent", {
    eventId: record.calendarEventId,
    phone: record.phone,
    kind,
  });
  return true;
}

export async function processAppointmentReminders(now = new Date()): Promise<number> {
  const eventIds = await getReminderIndexEventIds();
  let sent = 0;

  for (const eventId of eventIds) {
    const record = await getLifecycleRecord(eventId);
    if (!record) continue;
    if (record.lifecycleStatus === "cancelled") continue;
    if (!record.confirmationSentAt) continue;

    if (isMeetingCompleted(record, now)) {
      await saveLifecycleRecord({
        ...record,
        lifecycleStatus: "completed",
        updatedAt: now.toISOString(),
      });
      continue;
    }

    if (isMeetingDue(record, now) && record.lifecycleStatus !== "meeting_due") {
      await saveLifecycleRecord({
        ...record,
        lifecycleStatus: "meeting_due",
        updatedAt: now.toISOString(),
      });
    }

    const kind = nextReminderKind(record, now);
    if (!kind) continue;

    if (kind === "24h" && record.reminder24hSentAt) continue;
    if (kind === "2h" && record.reminder2hSentAt) continue;

    const ok = await sendReminder(record, kind, now);
    if (ok) sent += 1;
  }

  return sent;
}
