# Calendar, OAuth, and Booking

## Google Calendar Identity

| Setting | Value |
|---------|-------|
| OAuth identity | `info@624voice.com` |
| Calendar ID | `info@624voice.com` (via `GOOGLE_CALENDAR_ID` env) |
| Timezone | `America/Chicago` (`CONSULTATION_TIMEZONE`) |
| Auth mode | OAuth user (required for Meet-capable booking) |

Do not include secrets (client secret, refresh tokens, service account keys) in documentation or commits.

---

## Business Hours and Slot Grid

Defaults in `appointmentLifecycle/config.ts` and `consultationConfig.ts`:

| Parameter | Default |
|-----------|---------|
| Business days | Mon–Fri |
| Hours | 9:00–17:00 Central |
| Consultation duration | 25 minutes (`S2L_CONSULTATION_MINUTES`) |
| Buffer between slots | 10 minutes (`S2L_CONSULTATION_BUFFER_MINUTES`) |
| Slot grid interval | 15 minutes |

Override via `S2L_CONSULTATION_BUSINESS_HOURS_JSON`.

Daypart windows (`rangeResolver.ts`):
- Morning: 9:00–12:00
- Afternoon: 12:00–17:00
- Evening: 15:00–business end (late afternoon within grid)

---

## Calendar Provider Architecture

### Availability Engine

```
queryProviderAvailability()          (scheduling/provider.ts)
  → getConsultationSlots()           (googleCalendar.ts)
      → fetchCalendarEventsInRange()
      → buildBusyIntervalsFromEvents()
      → selectConsultationSlots()    (consultationSlots.ts)
```

**Google Calendar API is the source of calendar truth.** Generic booking page URLs are NOT the availability engine.

### Booking Engine

```
bookProviderSlot()                   (provider.ts)
  → bookConsultation()               (bookConsultation.ts)
  → createConsultationEvent()        (googleCalendar.ts)
      1. Idempotency lookup (Redis)
      2. Recheck slot availability
      3. insertCalendarEventWithDiagnostic (conferenceDataVersion=1)
      4. resolveCreatedEventMeetUrl (up to 3 re-reads)
      5. Save idempotency record (7-day TTL)
  → processCalendarEvent()           (processEvent.ts)
      → confirmation SMS, reminder scheduling
```

Event summary: `624Voice AI Consultation - {businessName}`

Extended properties: `s2lSource`, `s2lPhone`, `s2lBookingKey`, `s2lCreatedBy: "agent"`

Meet conference: `buildGoogleMeetConferenceCreateRequest(bookingKey)` via `googleMeetConference.ts`

Attendees: currently disabled (`supportsAttendeeInvites()` returns false) — no external attendee required for booking.

---

## OAuth Architecture

### Files

| File | Purpose |
|------|---------|
| `googleOAuthFlow.ts` | Start/callback/refresh |
| `googleOAuthConfig.ts` | Env + redirect URI |
| `googleOAuthStore.ts` | Redis token storage |
| `googleOAuthHandlers.ts` | HTTP handlers |
| `googleCalendarAuth.ts` | Auth mode resolution |
| `routes/setup/google-calendar.tsx` | Operator setup UI |

### Auth Resolution

`getGoogleCalendarProviderAccessToken()`:
1. Prefer OAuth user token (refresh if expired)
2. Service account JWT only when `allowServiceAccount: true` (availability reads, not Meet booking)

**Booking requires OAuth:** `isGoogleCalendarBookingConfigured()` → `isGoogleOAuthConnectionActive()`

### OAuth Flow

1. `startGoogleOAuthConnection` → state saved (10 min TTL)
2. Redirect to Google (`access_type=offline`, `prompt=consent`)
3. Callback at `/api/google/oauth/callback` → token exchange → email check → save connection
4. Tokens stored in Redis: `google:oauth:connection:{connectionId}`

Scopes: `calendar` + `openid email profile`

Env vars (names only): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CONNECTION_ID`, `GOOGLE_OAUTH_EXPECTED_EMAIL`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_CALENDAR_ID`

---

## Service Account History (Bug H → I)

### Problem

Service account could:
- Read availability
- Create basic events

Service account could **not**:
- Invite attendees without Domain-Wide Delegation (DWD)
- Create Google Meet conferences correctly

### Migration (commit `976a0da`)

Switched to OAuth user auth for booking. Validation sequence:
1. OAuth capability smoke passed
2. Full booking smoke passed
3. Real handset booking passed
4. Event created on Google Calendar
5. Google Meet URL in SMS matched persisted event URL

---

## Booking Page / Fallback Link History

### Two URLs Discovered

| URL | Role |
|-----|------|
| `https://calendar.app.google/U757QVWUJVK8x3a16` | Legacy/default referenced in older docs (`appointment-lifecycle-setup.md`) |
| `https://calendar.app.google/Jy8NRQgZrm5XFVRw9` | Operator-expected calendar for `info@624voice.com` |
| `https://calendar.app.google/hpzTSkjb9NTqaMjh9` | PDF/external link (`BOOK_MEETING_URL` in `features.ts`) |

### Current Canonical Fallback

`SPEED2LEAD_BOOKING_URL` in `src/config/features.ts`:
```
https://calendar.app.google/Jy8NRQgZrm5XFVRw9
```

Override via `SPEED2LEAD_BOOKING_URL` env. Stored per session as `context.bookingUrl` at creation via `getBookingUrl()`.

### Rules

- Provider must **NOT** use booking page URLs as availability engine
- Google API remains source of calendar truth
- Generic booking page is **fallback only** after legitimate scheduling failure
- Need one canonical fallback URL owner (`features.ts` → session `bookingUrl`)
- Relationship between appointment schedule embed and primary calendar has **not** been fully proven programmatically

### Prior Bug (P)

After prospect replies "All of it" / "Missed calls", agent sent generic calendar fallback link immediately. Unacceptable — triggered deployment/session audit.

Fix: `allowCalendarLinkFallback()` requires explicit request OR multiple failed availability attempts with no offered slots, and blocks on `applicationLogicFailure`.

---

## Booking Confirmation

### Required Structure

```
Booked for [weekday], [month] [day] at [time] [TZ].
Here's the Google Meet link: [google meet link].
I'll send you reminders before we meet.
Need to change it? Reply RESCHEDULE or CANCEL.
```

Implemented in `appointmentLifecycle/messages.ts` → `bookingConfirmationMessage()`, called via `buildBookingConfirmationMessage()` in `guardrails.ts`.

### Proven Successful Flow

1. Clear offered-slot selection
2. Provider re-check before book
3. Event creation via OAuth
4. Google Meet created (`hangoutsMeet` conference type)
5. Meet URL persisted to `context.scheduling.googleMeetUrl`
6. Immediate SMS confirmation with exact date/time/TZ/Meet
7. Reminders reuse same persisted URL

---

## Meet URL Policy (Bug R)

### Symptom

After booking, SMS said "Here's the Google Meet link:" but URL was stripped.

### Root Cause

Single `calendarLinkAllowed` policy controlled both:
- Generic calendar booking links (should be blocked)
- Persisted booked Meet URLs (should always be allowed)

### Fix

Typed semantic distinction in `outboundPolicy.ts`:

| Kind | Detection |
|------|-----------|
| `BOOKED_MEETING_LINK` | Matches `context.scheduling.googleMeetUrl` or confirmed + `meet.google.com` |
| `BOOKING_FALLBACK_LINK` | Matches `context.bookingUrl` or `calendar.app.google` |
| `UNAUTHORIZED_URL` | Everything else |

`finalizeCalendarLinkOutbound()` in `guardrails.ts`:
- Preserves `BOOKED_MEETING_LINK` URLs even when fallback links blocked
- Strips unauthorized URLs and broken self-sched copy

`containsUnauthorizedCalendarUrl()`: unauthorized if not `BOOKED_MEETING_LINK` when links disallowed.

---

## Diagnostic Endpoints

Cron smoke tests (Bearer `CRON_SECRET`):
- `/api/cron/calendar-oauth-smoke`
- `/api/cron/calendar-capability-smoke`
- `/api/cron/calendar-booking-smoke`
- `/api/cron/calendar-provider-smoke`

Scripts:
- `scripts/calendar-booking-smoke.ts`
- `scripts/calendar-availability-smoke.ts`

These prove OAuth + API + Meet at the infrastructure layer, not conversation scheduling state.
