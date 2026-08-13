# Appointment Lifecycle (Phase B)

Centralized Speed-to-Lead → Google Calendar booking → SMS confirmation → reminders.

## Architecture

- **Lead index** (`appointment:lead:phone:{phone}`) — array of leads registered when ROI, Contact, or Demo S2L starts (supports shared office phones with email disambiguation)
- **Lifecycle records** (`appointment:lifecycle:{eventId}`) — one record per Google Calendar event
- **Single active appointment per lead** — new matched bookings supersede prior active lifecycles
- **Reminder index** — active event IDs processed every 15 minutes (unchanged cadence)
- **Inbound SMS** — lifecycle handler runs before sales state machines for reschedule/cancel/meeting_booked
- **Booking detection** — Apps Script webhook push every **1 minute** (recommended) and/or optional server-side Google Calendar API polling every 10 minutes

## Match priority (production)

1. Normalized phone number (with email disambiguation when multiple leads share a phone)
2. Normalized email address
3. Deterministic correlation ID (future)

**Name-only matching is not used.** Name may only support phone/email matches when checking for mismatches.

## SMS consent

Lifecycle SMS (confirmation, reminders, reschedule, cancellation) requires **affirmative SMS consent** stored on the lead index at S2L registration. Opt-out (STOP) remains the stronger suppression rule.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `APPOINTMENT_LIFECYCLE_ENABLED` | No | Set `false` to disable (default: enabled) |
| `CALENDAR_SYNC_SECRET` | Yes (prod) | Bearer token for `POST /api/calendar/sync` |
| `CRON_SECRET` | Yes (prod) | Bearer token for cron routes |
| `GOOGLE_CALENDAR_ID` | For API sync/cancel | Calendar ID receiving bookings |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | For API sync/cancel | Service account with calendar access |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | For API sync/cancel | PEM private key (`\n` escaped) |

Existing Twilio, Redis, and `SPEED2LEAD_BOOKING_URL` vars are reused.

**Twilio Smart Encoding:** Not configured in this codebase. Lifecycle templates use GSM-7-safe punctuation (`-`, `'`).

## Booking detection

### Option A — Apps Script (recommended)

1. Copy `scripts/calendar-sync.gs` into the same Apps Script project as `leads-webhook.gs`
2. Enable **Google Calendar API** advanced service
3. Set script property `CALENDAR_SYNC_SECRET` (same value as Netlify)
4. Set `CALENDAR_ID` to the calendar tied to `https://calendar.app.google/U757QVWUJVK8x3a16`
5. Run `setupCalendarSyncTrigger()` once — creates a **1-minute** time-driven trigger

**Expected confirmation latency:** ~1–2 minutes after the booking appears in Google Calendar.

**Apps Script quota notes:**
- Time-driven triggers support a **minimum 1-minute** interval
- A 1-minute trigger consumes trigger quota; stay within your Google Workspace trigger limits
- Each run performs one Calendar `events.list` and one `UrlFetchApp.fetch` — well within typical daily UrlFetch quotas for a single calendar
- Initial lookback is 3 minutes to avoid missing events between runs

### Option B — Server-side Google Calendar API polling (optional supplement)

Netlify cron `appointment-calendar-sync` runs every **10 minutes** when `GOOGLE_CALENDAR_*` env vars are set. Use Apps Script 1-minute sync as the primary path for fast confirmations.

## Phone number in Google Appointment Schedule

Google Appointment Schedule **can** collect phone number as a custom booking question, but it is **not required by default**.

**Recommendation:** Add **Phone number** as a **required** booking question on the Appointment Schedule tied to `SPEED2LEAD_BOOKING_URL`.

## Reschedule behavior

When a customer texts RESCHEDULE:
1. Current lifecycle → `reschedule_pending`, reminders suppressed
2. Native Google manage link sent if available; otherwise generic booking link with explicit copy that a new booking replaces the current appointment
3. When a new event is matched for the same lead → old lifecycle superseded, one reschedule confirmation sent
4. Old calendar event cancelled via API when credentials exist; otherwise flagged `manual_cleanup_required`

**If customer never completes reschedule:** After 48 hours in `reschedule_pending`, the original appointment returns to `confirmed` and reminders resume if the appointment is still in the future.

## Cron routes

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/appointment-calendar-sync` | */10 | Optional server-side Calendar API poll |
| `/api/cron/appointment-reminders` | */15 | Send 24h and 2h reminders |

Reminder cron frequency is intentionally **not** tied to booking sync speed.

## Webhook

`POST /api/calendar/sync` — see previous examples. Authorization: `Bearer {CALENDAR_SYNC_SECRET}`

## Limitations

- **No-show detection** not implemented
- **Manual calendar cleanup** may be required when API cancel is unavailable during replacement bookings
- **Name-only matching** disabled by design
