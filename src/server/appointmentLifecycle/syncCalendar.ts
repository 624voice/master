import { isAppointmentLifecycleEnabled } from "~/server/appointmentLifecycle/config";
import { fetchCalendarEventsUpdatedSince } from "~/server/appointmentLifecycle/googleCalendar";
import { processCalendarEvents } from "~/server/appointmentLifecycle/processEvent";
import {
  parseWebhookCalendarEvent,
  type WebhookCalendarEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import { getSyncCursor, setSyncCursor } from "~/server/appointmentLifecycle/store";
import { releaseCronOverlapLock, tryAcquireCronOverlapLock } from "~/server/sms/sendState";

const DEFAULT_LOOKBACK_MS = 15 * 60 * 1000;

export async function syncCalendarFromGoogleApi(now = new Date()): Promise<number> {
  if (!isAppointmentLifecycleEnabled()) {
    return 0;
  }

  // Defense-in-depth / operational-efficiency only — not the correctness
  // boundary. Confirmation SMS is keyed on Google calendarEventId + message
  // type; this lock only avoids redundant overlapping 10-minute sync work.
  const overlap = await tryAcquireCronOverlapLock("appointment-calendar-sync", 180);
  if (!overlap) {
    return 0;
  }

  try {
  const cursor = await getSyncCursor();
  const updatedMin =
    cursor ??
    new Date(now.getTime() - DEFAULT_LOOKBACK_MS).toISOString();

  const events = await fetchCalendarEventsUpdatedSince(updatedMin);
  if (events.length === 0) {
    await setSyncCursor(now.toISOString());
    return 0;
  }

  await processCalendarEvents(events);

  const latestUpdated = events.reduce((max, event) => {
    return event.updatedAt > max ? event.updatedAt : max;
  }, updatedMin);

  await setSyncCursor(latestUpdated);
  return events.length;
  } finally {
    await releaseCronOverlapLock("appointment-calendar-sync", overlap);
  }
}

export async function ingestCalendarWebhookEvents(
  payload: WebhookCalendarEvent[],
): Promise<number> {
  if (!isAppointmentLifecycleEnabled()) {
    return 0;
  }

  const events = payload.map(parseWebhookCalendarEvent);
  await processCalendarEvents(events);
  return events.length;
}
