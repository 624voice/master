/**
 * 624 Voice — Google Calendar sync for appointment lifecycle (Phase B)
 *
 * Polls the shared booking calendar and POSTs new/updated events to the site.
 * Deploy as a time-driven Apps Script trigger (every 1 minute for booking detection).
 *
 * Setup:
 * 1. Enable Calendar advanced service OR use CalendarApp (built-in)
 * 2. Set CALENDAR_ID to the calendar receiving Appointment Schedule bookings
 * 3. Set SYNC_URL to https://www.624voice.com/api/calendar/sync
 * 4. Set SYNC_SECRET to match CALENDAR_SYNC_SECRET in Netlify env
 * 5. Run setupCalendarSyncTrigger once
 *
 * IMPORTANT: Share the calendar with the script's Google account if using a
 * dedicated calendar. Phone number availability depends on Appointment Schedule
 * form configuration — see docs/appointment-lifecycle-setup.md
 */

const CALENDAR_ID = "primary"; // Replace with booking calendar ID if different
const SYNC_URL = "https://www.624voice.com/api/calendar/sync";
const SYNC_SECRET = ""; // Set in Script Properties: CALENDAR_SYNC_SECRET
const LOOKBACK_MINUTES = 3;
const SYNC_CURSOR_KEY = "calendar_sync_cursor";

function getSyncSecret() {
  return PropertiesService.getScriptProperties().getProperty("CALENDAR_SYNC_SECRET") || SYNC_SECRET;
}

function getSyncCursor() {
  return PropertiesService.getScriptProperties().getProperty(SYNC_CURSOR_KEY);
}

function setSyncCursor(iso) {
  PropertiesService.getScriptProperties().setProperty(SYNC_CURSOR_KEY, iso);
}

function extractPhone(text) {
  if (!text) return "";
  var patterns = [
    /(?:phone|mobile|cell)(?:\s*(?:number|#))?\s*[:\-]?\s*(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i,
    /(\+1\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
    /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function extractMeetingLink(event) {
  if (event.hangoutLink) return event.hangoutLink;
  if (event.conferenceData && event.conferenceData.entryPoints) {
    for (var i = 0; i < event.conferenceData.entryPoints.length; i++) {
      var ep = event.conferenceData.entryPoints[i];
      if (ep.entryPointType === "video" && ep.uri) return ep.uri;
    }
  }
  return "";
}

function guestAttendee(event) {
  var guests = (event.attendees || []).filter(function (a) {
    return a.email && a.email.indexOf("calendar.google.com") === -1 && a.self !== true;
  });
  return guests[0] || null;
}

function mapEvent(event) {
  var guest = guestAttendee(event);
  var description = event.description || "";
  var phone = extractPhone(description) || extractPhone(event.summary || "");

  return {
    eventId: event.id,
    status: event.status,
    summary: event.summary || "",
    description: description,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    timezone: (event.start.timeZone || "America/Chicago"),
    attendeeEmail: guest ? guest.email : "",
    attendeeName: guest ? (guest.displayName || "") : "",
    attendeePhone: phone,
    meetingLink: extractMeetingLink(event),
    updatedAt: event.updated,
  };
}

function syncCalendarEvents() {
  var secret = getSyncSecret();
  if (!secret) {
    throw new Error("CALENDAR_SYNC_SECRET script property is not set");
  }

  var cursor = getSyncCursor();
  var now = new Date();
  var updatedMin = cursor
    ? new Date(cursor)
    : new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);

  var events = Calendar.Events.list(CALENDAR_ID, {
    singleEvents: true,
    orderBy: "updated",
    updatedMin: updatedMin.toISOString(),
    maxResults: 50,
  });

  var items = (events.items || []).map(mapEvent);
  if (items.length === 0) {
    setSyncCursor(now.toISOString());
    return { ok: true, processed: 0 };
  }

  var response = UrlFetchApp.fetch(SYNC_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify({ events: items }),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Sync webhook failed: " + code + " " + response.getContentText());
  }

  var latest = updatedMin.toISOString();
  for (var i = 0; i < items.length; i++) {
    if (items[i].updatedAt && items[i].updatedAt > latest) {
      latest = items[i].updatedAt;
    }
  }
  setSyncCursor(latest);

  return JSON.parse(response.getContentText());
}

function setupCalendarSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncCalendarEvents") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  // 1-minute polling for near-immediate booking confirmations.
  // Google Apps Script allows minimum 1-minute time-driven triggers.
  ScriptApp.newTrigger("syncCalendarEvents").timeBased().everyMinutes(1).create();
}

function testCalendarSync() {
  Logger.log(JSON.stringify(syncCalendarEvents()));
}
