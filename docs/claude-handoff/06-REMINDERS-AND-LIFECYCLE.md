# Reminders and Appointment Lifecycle

## Overview

After a consultation is booked, the appointment lifecycle manages:
- Confirmation SMS (immediate)
- 24-hour reminder
- 2-hour reminder
- Reschedule/cancel handling
- Duplicate-send protection

---

## Reminder Schedule

### Current Implementation (`reminderSchedule.ts`)

**Precise windows — never early:**

| Reminder | Eligible window | Meaning |
|----------|-----------------|---------|
| 24h | T−24h through T−23h | First cron at/after T−24h; late catch-up only through T−23h |
| 2h | T−2h through T−1h30m | First cron at/after T−2h; late catch-up only through T−1h30m |

Constants (`config.ts`):
- `REMINDER_MIN_SPACING_MS` = 30 min after confirmation (prevents immediate double-send)
- `REMINDER_24H_LATE_CATCHUP_MS` = 1 hour
- `REMINDER_2H_LATE_CATCHUP_MS` = 30 min

### Old Behavior (Bug K)

Previous windows were symmetric:
- 24h ±1h
- 2h ±30m

**Problem:** 24h reminder for Wed 10:30am fired Tue 9:30am (one hour early).

Fixed in commit `4332c2b`: "Use one-sided reminder windows so SMS never sends early"

### Skip Conditions

Both reminders skip if:
- Already sent (`reminder24hSentAt` / `reminder2hSentAt`)
- Cancelled lifecycle
- No confirmation sent yet
- Confirmation < 30 min ago

24h additionally skips if appointment ≤ 2h away.

2h skips if appointment in past.

### Short Lead-Time Skips (at confirmation)

In `processEvent.ts`:
- `shouldSkip24hForLeadTime` — appointment < 24h from confirmation → mark `reminder24hSentAt = "skipped_short_lead_time"`
- `shouldSkip2hForLeadTime` — appointment < 2h from confirmation

---

## Cron Processing

| Item | Detail |
|------|--------|
| Route | `GET /api/cron/appointment-reminders` |
| Cadence | `*/15 * * * *` (15-minute poll) |
| Auth | `Authorization: Bearer {CRON_SECRET}` or `X-Cron-Secret` header |
| Non-production | Missing secret allowed |
| Processor | `processAppointmentReminders()` in `processReminders.ts` |

Flow:
1. Iterate `appointment:reminder-index` Redis set
2. Load `appointment:lifecycle:{eventId}` for each
3. `nextReminderKind()` → `"24h"` or `"2h"` or null
4. Send via `sendLifecycleSms()`
5. Update lifecycle record with sent timestamp

---

## Reminder Messages

From `appointmentLifecycle/messages.ts`:

**24h:**
```
Reminder: we're set for [when]. Google Meet: [link] If anything changed, reply RESCHEDULE or CANCEL.
```

**2h:**
```
Reminder: we're on in about 2 hours at [time] [TZ]. Google Meet: [link] If you need to change it, just reply RESCHEDULE.
```

Both reuse the **persisted Meet URL** from lifecycle record (`meetingLink` field), not a generic calendar link.

---

## Lifecycle Record

### Redis Keys

| Key | TTL | Contents |
|-----|-----|----------|
| `appointment:lifecycle:{eventId}` | 90 days | Full lifecycle record |
| `appointment:active:phone:{phone}` | 90 days | Active eventId pointer |
| `appointment:reminder-index` | set | eventIds needing reminder polling |
| `appointment:lead:phone:{phone}` | 90 days | Lead index entries |
| `appointment:booking:idempotency:{phone}:{start}` | 7 days | Booking replay protection |

### Lifecycle Statuses

```
lead_active → booking_detected → confirmed
  → reminder_24h_sent → reminder_2h_sent → meeting_due → completed
```

Also: `reschedule_pending`, `rescheduled`, `superseded`, `cancelled`, `unmatched_booking`

### Duplicate-Send Protection

- `reminder24hSentAt` / `reminder2hSentAt` timestamps prevent re-send
- `remindersSuppressed` flag
- Cancelled/completed/superseded statuses suppress reminders
- `lifecycleStatus === "reschedule_pending"` suppresses until resolved

### Reschedule Handling

- User replies RESCHEDULE → `intents.ts` phrase detection
- `reschedule_pending` status with 48h max (`RESCHEDULE_PENDING_MAX_MS`)
- Old lifecycle may be superseded; new booking creates fresh lifecycle
- Reminders attach to active lifecycle record

### Cancel Suppression

- User replies CANCEL → lifecycle marked cancelled
- Reminders stop for cancelled records
- Cancel confirmation may include fallback calendar link

---

## Booking → Lifecycle Flow

```
bookConsultation() / createConsultationEvent()
  → processCalendarEvent() (processEvent.ts)
      → create/update lifecycle record
      → add to reminder-index
      → send confirmation SMS (if agent-booked)
      → evaluate short lead-time skip flags
      → set confirmationSentAt
```

Agent-booked consultations set `s2lCreatedBy: "agent"` on event extended properties.

Self-scheduled bookings detected via Apps Script sync also enter lifecycle.

---

## Current Validation Status

| Item | Status |
|------|--------|
| Precise window logic | CI green (`reminderSchedule.test.ts` — 23 tests) |
| 24h early send on old booking | Already fired before fix; will not resend |
| 2h reminder | Was the live validation point post-fix |
| Lifecycle integration | `zz-lifecycle.integration.test.ts` |

**Do not change reminder timing windows without explicit approval.** Recently fixed and validated at unit level.

---

## Reschedule / Cancel Keywords

From `appointmentLifecycle/intents.ts`:
- RESCHEDULE phrases: "reschedule", "different time", "move it", etc.
- CANCEL phrases: "cancel", "can't make it", etc.

Handled in inbound path when lifecycle is active for the phone.
