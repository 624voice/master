# CLAUDE MASTER CONTEXT — 624Voice Speed-to-Lead SMS Agent

Paste this document into a Claude conversation to take over as primary architecture partner.

---

## Project Summary

**624Voice Speed-to-Lead SMS Agent** converts ROI-report leads into booked 25-minute consultations via SMS.

**Primary KPI:** ROI report download → first meeting booked.

**Core flow:** ROI report → 1–2 discovery questions → pain/consequence reflection → outcome bridge → meeting interest → real Google Calendar scheduling → booking → Google Meet confirmation → 24h + 2h SMS reminders.

**Non-goal:** Full prospect qualification over SMS.

**Current status: NOT READY** for handset validation sign-off.

---

## Business Context

624Voice sells Speed-to-Lead agents, AI Voice Receptionist, and conversion websites for home-service businesses (typically 7–20 trucks).

Buyer priorities: more booked jobs, less missed revenue, faster response, less manual follow-up, less front-office workload, more capacity without headcount, simplicity, ROI.

**Do not lead with AI.** Bridge structure: pain → consequence → desired outcome → lower effort → 25-minute conditional ask.

Discovery: max 2 diagnostic questions. Rich single answer → bridge after one. Explicit meeting intent skips discovery. After meeting interest confirmed → no more discovery. ROI report already has substantial data — don't re-ask known facts.

---

## Current Git / Deploy State

| Item | Value |
|------|-------|
| Branch | `cursor/llm-orchestrator-537c` |
| Commit | `7af6fb1bd82c6f1195c748a562227f0293346bb3` |
| Architecture PR | #80 merged (`cursor/scheduling-state-architecture-537c`) |
| Integration PR | #61 → preview-61 |
| Tests | 657 pass, 1 skip, 0 fail |
| CI | 4/4 green |
| Preview | `https://deploy-preview-61--624voice.netlify.app` |
| Preview SHA | `7af6fb1` (verify via `/api/health`) |

---

## Current Blocker

**Unsigned POST to `/api/sms/inbound` returns 403** — Twilio signature validation active on preview (`NODE_ENV=production`).

A–H deployed-boundary scheduling sequence has NOT been completed through the real webhook.

Next validation: Twilio-signed preview requests OR real handset SMS on allowlisted numbers:
- `+1XXXXXXXXXX` / `+1YYYYYYYYYY` (allowlisted via `SPEED2LEAD_TEST_PHONES` on preview)

Sessions cleared. Do not expose secrets. Do not disable signature validation.

**Major lesson:** Unit tests, integration tests, orchestrator tests, and live evals are NOT sufficient alone. Deployed Twilio webhook boundary must be validated before READY.

---

## Architecture

### Runtime Path

```
Twilio SMS → POST /api/sms/inbound → signature validation
→ handleInboundSms → session load (Redis)
→ orchestrateInboundTurn
   → conversation/stage/discovery/meeting-interest (code)
   → planSchedulingGate → enforceSchedulingGate
   → processSchedulingTurn → Google provider → booking
   → resolveAuthoritativeSchedulingReply (wins over LLM)
   → validateOutboundSms + finalizeCalendarLinkOutbound
→ sendSms
```

### Owner Map

**LLM owns:** natural language, contextual acknowledgment, pain/consequence articulation, bridge wording, FAQ answers using allowedFacts.

**Code owns:** conversation stage, discovery count, meeting interest, scheduling entry legality, ALL scheduling state mutations, request keys, provider truth, slot filter/rank, exact-time checking, booking, Meet URL, reminders, fallback link eligibility, session identity, outbound guardrails, authoritative scheduling SMS.

**Design principle: ONE BEHAVIOR = ONE OWNER.**

**Prompt principle: PROMPT = judgment + language. CODE = state + truth + actions + invariants.**

---

## Prompt Architecture

**Source:** `src/server/speed2Lead/prompts.ts` → `buildOrchestratorInstructions()`

**Business context:** `src/server/speed2Lead/businessContext.ts`

**Assembly:** JSON payload with persona, task, taskGuidance, stage, businessContext, outcomeBridgeContext, allowedFacts, knownFacts, currentTime, flowContext.

**Size:** ~3,600–3,750 chars (~900 tokens) per turn.

**Hard constraint in prompt:** "No calendar times, bookings, or links."

**Intentionally NOT in prompt (code-owned):** scheduling rules, stage transitions, discovery limits, slot offers, booking confirmations, calendar links, reminder timing.

See `CURRENT_SYSTEM_PROMPT.txt` for sample assembled prompt.

---

## Scheduling Architecture (Critical)

### Canonical Fields

`requestedDate`, `availabilityPreference`, `exactTimeMinutes`, `anchorTimeMinutes`, `lowerTimeBound`, `upperTimeBound`, `activeRequestKey`, `offeredSlots`, `rejectedSlotStarts`, `selectedStart`, `calendarEventId`, `googleMeetUrl`, `status`

### State Update (Post-7af6fb1)

Single owner path:
```
parseSchedulingStateUpdate() → applySchedulingStateUpdate() → processSchedulingTurn()
```

Explicit semantics: **PRESERVE / REPLACE / CLEAR** per field (`stateUpdate.ts`).

No second parsing pass. `detectSchedulingConstraints()` is shim only.

### Key Semantics

| Intent | Behavior |
|--------|----------|
| New date | Replace date, clear time constraints, invalidate offers |
| New daypart | Replace preference, clear exact/anchor/bounds |
| New exact time | Replace exact, clear anchor/bounds, fresh query |
| Negation ("No 4pm") | Reject, clear matching exact, never book |
| Broadening | Clear narrow constraints, fresh broader query |

### Core Bug (Fixed in 7af6fb1)

Additive preserve/`??` semantics accumulated impossible constraints:
```
lower: 960 (4pm) > upper: 720 (noon) + stale exact/anchor
```
Friday morning Google slots filtered out despite calendar being open.

Fix: FieldUpdate model + single apply path + request key invalidation.

### Evening

"Evenings work better" = late afternoon 3–5pm within 9–5 business grid.

---

## Calendar / OAuth / Booking

| Setting | Value |
|---------|-------|
| OAuth identity | `info@624voice.com` |
| Calendar ID | `info@624voice.com` |
| Timezone | `America/Chicago` |
| Auth | OAuth user (required for Meet booking) |
| Hours | Mon–Fri 9–5 CT, 25-min consultations, 10-min buffer, 15-min grid |

Google Calendar API = source of truth. Booking page URLs are fallback only.

**Fallback URL:** `https://calendar.app.google/Jy8NRQgZrm5XFVRw9` (`SPEED2LEAD_BOOKING_URL`)
**Legacy URL:** `https://calendar.app.google/U757QVWUJVK8x3a16` (old docs only)
**PDF URL:** `https://calendar.app.google/hpzTSkjb9NTqaMjh9`

Service account could read/create but not Meet/attendees → migrated to OAuth.

### URL Policy

Typed in `outboundPolicy.ts`:
- `BOOKED_MEETING_LINK` — persisted Meet URL, always allowed
- `BOOKING_FALLBACK_LINK` — generic calendar.app.google
- `UNAUTHORIZED_URL` — blocked

Bug R fix: Meet URLs no longer stripped from confirmations.

### Booking Confirmation

```
Booked for [day], [date] at [time] [TZ].
Here's the Google Meet link: [url].
I'll send you reminders before we meet.
Need to change it? Reply RESCHEDULE or CANCEL.
```

---

## Reminders

- 24h: eligible T−24h to T−23h (never early)
- 2h: eligible T−2h to T−1h30m (never early)
- Cron: `*/15 * * * *` via `/api/cron/appointment-reminders`
- Same persisted Meet URL in all messages
- Cancel/reschedule suppresses reminders

Old symmetric windows caused 24h to fire 1h early — fixed in `4332c2b`.

---

## Session / Redis

- Session: `speed2lead:session:{phone}` (14-day TTL)
- Lifecycle: `appointment:lifecycle:{eventId}`
- Active booking: `appointment:active:phone:{phone}`
- Reminder index: `appointment:reminder-index`
- OAuth: `google:oauth:connection:{id}`

Risk: last-write-wins on concurrent SMS to same phone.

Test reset: `scripts/reset-s2l-test-phone.ts` (allowlist-gated, clears session not OAuth).

---

## Bug History (Abbreviated)

| ID | Issue | Status |
|----|-------|--------|
| A–C | Discovery/stage instability | Solved |
| D–F | Stale slots, false conflicts | Solved (7af6fb1) |
| G–I | Service account → OAuth migration | Solved |
| J | Handset booking + Meet | Solved |
| K | Early 24h reminder | Solved (unit) |
| L | Directional language | Partial |
| M–V | Stale state, negation, bounds | Solved (7af6fb1) |
| W–X | Duplicate owners, additive state | Solved (7af6fb1) |
| P | Premature fallback link | Solved |
| Q | Preview SHA mismatch | Solved (health endpoint) |
| R | Meet URL stripping | Solved |
| S | Evening grid conflict | Solved |
| Y | Twilio signature 403 | Validation Pending |

Full table in `08-BUG-HISTORY-AND-ROOT-CAUSES.md`.

---

## Failed Approaches (Do Not Repeat)

1. Phrase-level / transcript-specific fixes
2. Prompt-only scheduling rules
3. Multiple modules parsing constraints
4. Default preserve stale state
5. Live eval = deployed success
6. Unsigned HTTP to preview inbound
7. Single URL policy for Meet + fallback
8. "Yes/sure" without context check
9. Assuming PR changes in preview without SHA check
10. NO_AVAILABILITY for internal state failures
11. Generic calendar link as scheduling engine

Full list in `09-ATTEMPTED-FIXES-AND-LESSONS.md`.

---

## A–H Validation Sequence (Required Before READY)

Through signed webhook or handset on preview:

| Step | Message | Expected |
|------|---------|----------|
| A | "Evenings work better" (Thu) | Evening = 3–5pm grid |
| B | "What about 5?" | Exact 5pm, fresh check |
| C | "4?" | Replace 5pm with 4pm |
| D | "No 4pm" | Reject, never book 4pm |
| E | "Then Friday" | New date, clear Thursday stale |
| F | "Need a morning time on Friday" | Morning, clear exact/anchor/bounds |
| G | "10am?" | Exact Friday 10am |
| H | "What morning times on Friday?" | Broaden, clear exact, return morning slots |

Inspect per turn: canonical state, request key, provider query, raw slots, filtered slots, final SMS.

---

## Non-Negotiable Rules

1. Architecture before patch
2. One behavior = one owner
3. No scheduling rules in prompt
4. Explicit preserve/replace/clear semantics
5. Negation before time extraction
6. Broader request clears narrower state
7. Google API = calendar truth
8. Meet URL = trusted booked data
9. No fake async
10. No booking without provider-backed time
11. No READY without deployed boundary proof
12. After 2–3 failed patches → audit architecture
13. Do not disable Twilio signature validation
14. Do not merge to master without explicit approval

---

## What NOT to Change

- OAuth credentials / flow
- Google Meet creation logic
- Reminder timing windows
- Twilio signature validation
- Production config
- Transcript-specific patches

---

## Next Step

1. Read full handoff in `docs/claude-handoff/`
2. Verify preview SHA = `7af6fb1`
3. Run A–H via real handset on allowlisted test number
4. Document results per turn
5. Only then recommend code changes if needed

**Do not write code until deployed-boundary evidence exists.**

---

## Handoff Document Index

| File | Topic |
|------|-------|
| `00-START-HERE.md` | Executive briefing |
| `01-BUSINESS-AND-PRODUCT-CONTEXT.md` | Business/product |
| `02-CURRENT-ARCHITECTURE.md` | Runtime path, owner map |
| `03-CONVERSATION-AND-PROMPT.md` | Prompt architecture |
| `04-SCHEDULING-ARCHITECTURE.md` | Scheduling (most important) |
| `05-CALENDAR-OAUTH-BOOKING.md` | Calendar/OAuth/booking |
| `06-REMINDERS-AND-LIFECYCLE.md` | Reminders |
| `07-SESSION-STATE-AND-PERSISTENCE.md` | Redis/session |
| `08-BUG-HISTORY-AND-ROOT-CAUSES.md` | Bug chronology |
| `09-ATTEMPTED-FIXES-AND-LESSONS.md` | Failed approaches |
| `10-CURRENT-STATUS-AND-BLOCKERS.md` | Current state |
| `11-TARGET-END-STATE.md` | Ideal behavior |
| `12-VALIDATION-PLAN.md` | Test layers + A–H |
| `13-FILE-MAP.md` | File reference |
| `14-CLAUDE-OPERATING-INSTRUCTIONS.md` | Operating instructions |
| `CURRENT_SYSTEM_PROMPT.txt` | Sample assembled prompt |
