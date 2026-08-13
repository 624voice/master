# Appointment Lifecycle (Phase B)

Centralized Speed-to-Lead → Google Calendar booking → SMS confirmation → reminders.

## Architecture

- **Lead index** (`appointment:lead:phone:*`) — registered when ROI, Contact, or Demo S2L starts
- **Lifecycle records** (`appointment:lifecycle:{eventId}`) — one record per Google Calendar event
- **Reminder index** — set of active event IDs processed every 15 minutes
- **Inbound SMS** — lifecycle handler runs before sales state machines for reschedule/cancel/meeting_booked
- **Booking detection** — Google Calendar API polling and/or Apps Script webhook push

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `APPOINTMENT_LIFECYCLE_ENABLED` | No | Set `false` to disable (default: enabled) |
| `CALENDAR_SYNC_SECRET` | Yes (prod) | Bearer token for `POST /api/calendar/sync` |
| `CRON_SECRET` | Yes (prod) | Bearer token for cron routes |
| `GOOGLE_CALENDAR_ID` | For API sync | Calendar ID receiving bookings |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | For API sync | Service account with calendar access |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | For API sync | PEM private key (`\n` escaped) |

Existing Twilio, Redis, and `SPEED2LEAD_BOOKING_URL` vars are reused.

## Booking detection options

### Option A — Apps Script (recommended to start)

1. Copy `scripts/calendar-sync.gs` into the same Apps Script project as `leads-webhook.gs`
2. Enable **Google Calendar API** advanced service
3. Set script property `CALENDAR_SYNC_SECRET` (same value as Netlify)
4. Set `CALENDAR_ID` to the calendar tied to `https://calendar.app.google/U757QVWUJVK8x3a16`
5. Run `setupCalendarSyncTrigger()` once

### Option B — Server-side Google Calendar API polling

1. Create a Google Cloud service account
2. Share the booking calendar with the service account email (Make changes to events)
3. Set `GOOGLE_CALENDAR_*` env vars in Netlify
4. Netlify cron `appointment-calendar-sync` runs every 10 minutes

## Phone number in Google Appointment Schedule

Google Appointment Schedule **can** collect phone number as a custom booking question, but it is **not required by default**. The phone typically appears in the event **description** when configured.

**Recommendation:** Add **Phone number** as a required booking question on the Appointment Schedule tied to `SPEED2LEAD_BOOKING_URL`. This enables Priority 1 matching and is strongly recommended for safe automated SMS.

## Manual steps

1. Add Netlify env vars: `CALENDAR_SYNC_SECRET`, optionally Google Calendar API credentials
2. Deploy the site (includes new cron functions)
3. Set up Apps Script calendar sync OR Google Calendar API access
4. Verify a test booking creates a lifecycle record and confirmation SMS

## Cron routes

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/appointment-calendar-sync` | */10 | Poll Google Calendar (if API configured) |
| `/api/cron/appointment-reminders` | */15 | Send 24h and 2h reminders |

## Webhook

`POST /api/calendar/sync`

```json
{
  "events": [{
    "eventId": "abc123",
    "status": "confirmed",
    "start": "2026-08-15T15:00:00.000Z",
    "end": "2026-08-15T15:30:00.000Z",
    "timezone": "America/Chicago",
    "attendeeEmail": "lead@example.com",
    "attendeePhone": "+15551234567",
    "attendeeName": "Jane Doe",
    "meetingLink": "https://meet.google.com/xyz"
  }]
}
```

Authorization: `Bearer {CALENDAR_SYNC_SECRET}`

## Limitations

- **Automatic calendar cancellation via SMS** requires Google Calendar API credentials; without them, cancel replies send a manual link response
- **No-show detection** is not implemented — Google Calendar does not provide reliable attendance data
- **Reschedule linking** uses native manage link when present; otherwise falls back to `SPEED2LEAD_BOOKING_URL`
- Old appointment is not auto-deleted on reschedule unless Calendar API cancel is configured
