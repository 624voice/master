import { isAppointmentLifecycleEnabled } from "~/server/appointmentLifecycle/config";
import { fetchCalendarEventsUpdatedSince } from "~/server/appointmentLifecycle/googleCalendar";
import { processCalendarEvents } from "~/server/appointmentLifecycle/processEvent";
import {
  parseWebhookCalendarEvent,
  type WebhookCalendarEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import { getSyncCursor, setSyncCursor } from "~/server/appointmentLifecycle/store";

const DEFAULT_LOOKBACK_MS = 15 * 60 * 1000;

export async function syncCalendarFromGoogleApi(now = new Date()): Promise<number> {
  if (!isAppointmentLifecycleEnabled()) {
    return 0;
  }

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
