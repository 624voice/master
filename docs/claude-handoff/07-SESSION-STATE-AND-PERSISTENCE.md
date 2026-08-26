# Session, State, and Persistence

## Storage Backend

**Upstash Redis** via REST API (`src/server/speed2Lead/redis.ts`).

Env vars (names only): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Session Key Structure

| Key | TTL | Contents |
|-----|-----|----------|
| `speed2lead:session:{phone}` | 14 days | Full `AnyConversationContext` |
| `speed2lead:optout:{phone}` | none | STOP/opt-out flag |
| `speed2lead:report:{token}` | 30 days | Report access token |
| `speed2lead:nurture-followups` | — | Nurture follow-up index |
| `speed2lead:demo-followups` | — | Demo follow-up index |

Phone numbers normalized via `normalizePhone()` in `src/server/sms/phone.ts`.

---

## Session Shape

Root fields on `AnyConversationContext`:
- `phone`, `firstName`, `flow` (`roi` | `contact` | `demo`)
- `bookingUrl`, `reportUrl`
- `state`, `updatedAt`, `disposition`
- `messages` (max 20 turns)
- `knownFacts` — discovery memory
- `scheduling` — canonical scheduling state mirror
- `lastTurnSemantics` — turn classification cache

### Scheduling State Mirror

Stored in `context.scheduling` (`SchedulingState` in `sessionMemoryTypes.ts`):

Includes both canonical fields (`requestedDate`, `availabilityPreference`, `exactTimeMinutes`, `activeRequestKey`, `offeredSlots`, `selectedStart`, `calendarEventId`, `googleMeetUrl`, `status`) and legacy aliases (`centralDate`, `partOfDay`, constraint fields).

Session save path: `saveSession()` → `prepareSessionForSave()` → Redis with TTL.

Load path: `getSession()` → `normalizeSessionMemory()`.

---

## Session API

| Function | File | Purpose |
|----------|------|---------|
| `getSession(phone)` | `session.ts` | Load + normalize |
| `saveSession(context)` | `session.ts` | Persist with TTL |
| `createSession(...)` | `session.ts` | ROI flow initializer |
| `clearSession(phone)` | `session.ts` | Delete session key |
| `clearOptedOut(phone)` | `session.ts` | Clear opt-out |

Memory helpers in `memory.ts`:
- `applyConfirmedScheduling` — sets disposition booked, status confirmed, Meet URL
- `applySchedulingMeta` — partial field updates
- `applyOfferedSlots`, `invalidateIncompatibleOfferedSlots`

---

## Lifecycle Keys (Separate from Session)

| Key | Purpose |
|-----|---------|
| `appointment:lifecycle:{eventId}` | Booking record, reminder timestamps, Meet URL |
| `appointment:active:phone:{phone}` | Points to active eventId for phone |
| `appointment:reminder-index` | Set of eventIds for cron polling |
| `appointment:lead:phone:{phone}` | Lead history index |
| `appointment:booking:idempotency:{phone}:{start}` | Prevents double-book |

---

## OAuth Connection Storage

| Key | Purpose |
|-----|---------|
| `google:oauth:connection:{connectionId}` | OAuth tokens (default id: `primary`) |
| `google:oauth:state:{state}` | CSRF state (10 min TTL) |
| `google:oauth:setup-session:{id}` | Setup UI session |

OAuth is **shared config** — not cleared during test session reset.

---

## Active Booking Linkage

When booking confirms:
1. `context.scheduling.status` → `"confirmed"`
2. `context.scheduling.googleMeetUrl` persisted
3. `context.disposition` → `"booked"`
4. Lifecycle record created with `appointment:active:phone:{phone}` pointer
5. Event added to `appointment:reminder-index`

Post-book FAQ answers must not break booking state — scheduling disposition stays booked, gate handles customer questions without re-entering discovery.

---

## Concurrent Access Risk

**Last-write-wins** under concurrent SMS to the same phone number.

Two rapid inbound messages could race on `getSession` → modify → `saveSession`. No distributed locking currently implemented.

Mitigation in practice: SMS conversations are sequential per handset. Risk is low but non-zero for rapid double-texts.

---

## Session Isolation Testing

Regression tested: two separate phone sessions do not cross-contaminate state.

Test: `deployedBoundarySmoke.test.ts` — "H: two fresh sessions start with clean scheduling state"

Each phone gets independent Redis key. No shared mutable state between phones except OAuth connection and reminder index (by eventId, not phone collision).

---

## Test Session Cleanup

### Script

```bash
bun run scripts/reset-s2l-test-phone.ts +1XXXXXXXXXX
```

Implementation: `src/server/speed2Lead/resetTestPhone.ts`

### What Gets Cleared

| Item | Cleared? |
|------|----------|
| Session (`speed2lead:session:{phone}`) | Yes |
| Opt-out flag | Yes |
| Demo follow-up index entry | Yes |
| Nurture follow-up index entry | Yes |
| Active lifecycle for phone | Yes (`clearActiveLifecycleForPhone`) |

### What Does NOT Get Cleared

| Item | Reason |
|------|--------|
| OAuth connection | Shared operator config |
| Reminder index (unrelated eventIds) | Other bookings unaffected |
| Unrelated lifecycle records | Only active phone pointer cleared |
| Env/config | Production settings |

### Safety Gate

Only phones in `SPEED2LEAD_TEST_PHONES` allowlist can be reset. Non-allowlisted phones throw error.

Known test numbers (allowlisted on preview):
- `+12148438991`
- `+18178544399`

Sessions for these numbers were cleared before this handoff.

---

## Turn Semantics Cache

`lastTurnSemantics` on session stores classification from `turnSemantics.ts` to avoid re-parsing within repair loops. Cleared on new inbound turn.

---

## Message History

Max 20 messages stored in session for LLM context window management. Older messages dropped on save.

Orchestrator uses recent history for LLM calls but scheduling truth always comes from structured `scheduling` state, not transcript parsing.
