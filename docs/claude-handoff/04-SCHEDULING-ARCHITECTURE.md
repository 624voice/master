# Scheduling Architecture

**This is the most important technical document in the handoff package.**

## Overview

Scheduling is **fully code-owned**. The LLM must not offer times, check availability, or send calendar links. All scheduling SMS comes from `processSchedulingTurn()` and `enforceSchedulingGate()`.

Design principle: **ONE BEHAVIOR = ONE OWNER**

---

## Canonical Scheduling Fields

Defined in `src/server/scheduling/types.ts` and mirrored in session (`sessionMemoryTypes.ts`):

| Field | Purpose |
|-------|---------|
| `requestedDate` | Central `YYYY-MM-DD` target date |
| `availabilityPreference` | `earliest` \| `full_day` \| `morning` \| `afternoon` \| `evening` \| `exact_time` |
| `exactTimeMinutes` | Minutes from midnight for exact-time requests |
| `anchorTimeMinutes` | "Around/about" time — ranked proximity, not exact filter |
| `lowerTimeBound` | Earliest acceptable minute (maps to `searchAfterMinutes` / `earliestAllowedMinutes`) |
| `upperTimeBound` | Latest acceptable minute (maps to `searchBeforeMinutes` / `latestAllowedMinutes`) |
| `activeRequestKey` | Fingerprint of current semantic request — stale-offer invalidation |
| `offeredSlots` | Provider-backed ISO start times currently offered |
| `lastPresentedOfferKey` | Hash of last offered slot set |
| `rejectedSlotStarts` | Explicitly rejected ISO starts (e.g., "No 4pm") |
| `rejectedPartOfDay` | Rejected dayparts |
| `selectedStart` | Chosen slot for booking |
| `calendarEventId` | Google event ID after booking |
| `googleMeetUrl` | Persisted Meet URL |
| `status` | `idle` \| `slots_offered` \| `confirmed` |

---

## State Update Architecture (Post-7af6fb1)

### Single Canonical Owner

```
inbound message
  → parseSchedulingStateUpdate()     (intentParser.ts)
  → applySchedulingStateUpdate()     (stateUpdate.ts)
  → processSchedulingTurn()          (service.ts)
```

**No second pass.** The legacy `detectSchedulingConstraints()` in `schedulingContext.ts` now delegates to the canonical path (shim only). `service.ts` calls `applyInboundSchedulingUpdate()` once per turn.

### FieldUpdate Semantics

```typescript
type FieldUpdate<T> =
  | { op: "preserve" }      // keep prior value
  | { op: "replace"; value: T }
  | { op: "clear" };        // explicitly remove

type RejectedSlotUpdate =
  | { op: "preserve" }
  | { op: "clear" }
  | { op: "add"; values: string[] };
```

`applySchedulingStateUpdate(prior, update)` in `stateUpdate.ts` is the **only** canonical mutation function.

`invalidateOffers: true` clears `offeredSlots`, `lastPresentedOfferKey`, and resets `status` from `slots_offered` → `idle`.

---

## PRESERVE / REPLACE / CLEAR Semantics

### NEW DATE

| Action | Semantics |
|--------|-----------|
| `requestedDate` | **REPLACE** with new date |
| Time constraints | **CLEAR** (exact, anchor, bounds) |
| Rejected slots/dayparts | **CLEAR** |
| Offered slots | **INVALIDATE** |
| Prior exact time on old date | Must not carry to new date |

Example: "Then Friday" after Thursday evening constraints → fresh Friday state.

### NEW DAYPART

| Action | Semantics |
|--------|-----------|
| `availabilityPreference` | **REPLACE** (e.g., `morning`) |
| `exactTimeMinutes` | **CLEAR** |
| `anchorTimeMinutes` | **CLEAR** |
| `lowerTimeBound` / `upperTimeBound` | **CLEAR** if incompatible |
| Offers | **INVALIDATE** |

Example: "Need a morning time on Friday" after exact 10am → morning preference, no exact/anchor/bounds.

### NEW EXACT TIME

| Action | Semantics |
|--------|-----------|
| `exactTimeMinutes` | **REPLACE** (e.g., 4pm replaces 5pm) |
| `availabilityPreference` | **REPLACE** → `exact_time` |
| `anchorTimeMinutes` | **CLEAR** |
| Bounds | **CLEAR** |
| Provider | Fresh exact-time query |

Examples:
- "What about 5?" → exact 5pm (1020 min)
- "4?" → replaces 5pm with 4pm (960 min)

### NEGATED TIME

| Action | Semantics |
|--------|-----------|
| Matching exact/anchor | **CLEAR** |
| Rejected slot | **ADD** to `rejectedSlotStarts` |
| Selection | **NEVER** book negated slot |
| Offers | **INVALIDATE** if needed |

Example: "No 4pm" → rejection, not selection. `resolveOfferedSlotSelectionCandidate` returns null for negated offered slots.

### BROADENING

| Action | Semantics |
|--------|-----------|
| exact → morning/afternoon/full_day | **CLEAR** exact, anchor, narrow bounds |
| Provider | Fresh broader query |
| Offers | **INVALIDATE** |

Example: "What morning times do you have on Friday?" after "10am?" → broaden to Friday morning, clear exact 10am.

### ANCHOR / DIRECTIONAL

- "Around 3" → `anchorTimeMinutes`, not exact
- "Earlier" / "Later" → adjust bounds, may invalidate offers
- "Before 4" / "After 2" → set upper/lower bounds

---

## The Core Bug (Pre-7af6fb1)

### Symptom

Friday morning slots filtered out despite Google Calendar returning availability.

### Root Cause

State accumulated constraints **additively** using preserve/`??` semantics across multiple parsing passes. Impossible combinations persisted:

```
requestedDate: 2026-08-28 (Friday)
availabilityPreference: morning
exactTimeMinutes: 600        (10am — stale from prior turn)
anchorTimeMinutes: 1020      (5pm — stale from Thursday)
lowerTimeBound: 960          (4pm)
upperTimeBound: 720          (noon)
```

Result: `lower (960) > upper (720)` — filter eliminated all slots including valid Friday 10am openings.

### Historical Example (A–H Sequence Context)

Turn sequence that exposed the bug:
1. Thursday → "Evenings work better" (evening preference)
2. "What about 5?" (exact 5pm)
3. "4?" (exact 4pm)
4. "No 4pm" (reject 4pm)
5. "Then Friday" (new date)
6. "Need a morning time on Friday"
7. "10am?"
8. "What morning times do you have on Friday?"

At step 6–8, stale Thursday evening/5pm/4pm constraints were still filtering Friday morning despite provider truth showing open slots.

### Fix (7af6fb1)

- Explicit `FieldUpdate` model with PRESERVE/REPLACE/CLEAR
- Single apply path in `applyInboundSchedulingUpdate()`
- Removed duplicate `detectSchedulingConstraints` second pass in `service.ts`
- `validateSchedulingConstraints()` rejects impossible bounds
- `normalizeImpossibleBounds()` repairs corrupted state before provider query
- `invalidateOffersForRequestChange()` on request key change

---

## Request Key (`requestKey.ts`)

Fingerprint for stale-offer detection:

```
date:{YYYY-MM-DD}|exact:{minutes}[|lo:{n}|hi:{n}|anchor:{n}]
date:{YYYY-MM-DD}|{preference}[|bounds...]
earliest:global[|bounds...]
range:{rangeStart}|{rangeEnd}
```

Functions:
- `buildSchedulingRequestKey(state)`
- `offerSetKey(slots)` — sorted join for offer set identity
- `requestKeyChanged(prior, next)` — triggers offer invalidation

---

## Turn Processing (`service.ts`)

`processSchedulingTurn(input)` flow:

1. Exit if `status === "confirmed"` → `BOOKED`
2. `explicitBookStart` → direct book
3. `applyInboundSchedulingUpdate(message)` — single canonical parse+apply
4. Optional `availabilityInput` overlay from gate
5. `normalizeImpossibleBounds()`
6. Offered-slot selection → book if match + `bookCustomer`
7. Range query path if applicable
8. `buildRequestFromCanonicalState()`
9. `buildSchedulingRequestKey()` + `invalidateOffersForRequestChange()`
10. Closed-day check → `NEED_DATE`
11. Exact-time path with auto-book on single match
12. Exact unavailable → fallback alternatives
13. `fetchSlotsForRequest()` → `filterAndRankSlots()` → `finalizeOfferResult()`

Outcomes: `NEED_DATE`, `OFFERED_SLOTS`, `BOOKED`, `PROVIDER_ERROR`, `EXACT_TIME_UNAVAILABLE`, `REAL_NO_AVAILABILITY`, `INVALID_INTERNAL_CONSTRAINT`, etc.

---

## Filter / Rank (`filterRank.ts`)

Post-provider slot selection:
- `exact_time`: filter to exact minute, max 1 slot
- Daypart: morning < 12:00, afternoon 12:00–17:00, evening ≥ 15:00 (within 9–5 grid)
- Bounds: filter by `lowerTimeBound` / `upperTimeBound`
- Anchor: sort by proximity ±90 min tolerance
- `earliest`: first N chronologically
- Default: `pickSpreadSlots` — min 45 min separation, max 3

Secondary pass: `filterSlotsForSchedulingState()` rejects rejected slots/dayparts.

---

## Range Resolver (`rangeResolver.ts`)

Maps date + daypart → provider query window:
- Morning: 9:00–12:00 CT
- Afternoon: 12:00–17:00 CT
- Evening: 15:00–business end CT
- Business hours default: Mon–Fri 9:00–17:00 CT

---

## Scheduling Gate (`schedulingGate.ts`)

Orchestration layer between conversation and `processSchedulingTurn`:

**Gate actions:** `none`, `ask_preference`, `answer_customer_question`, `get_availability`, `get_availability_for_request`, `book_appointment`

Key functions:
- `planSchedulingGate()` — decides action from message + context
- `enforceSchedulingGate()` — runs turn, persists state, builds forced reply
- `resolveAuthoritativeSchedulingReply()` — deterministic reply wins over LLM
- `allowCalendarLinkFallback()` — explicit request OR `calendarUnavailable && availabilityAttempts >= 2 && no offered slots`; blocked if `applicationLogicFailure`

---

## Evening Semantics

"Evenings work better" maps to `availabilityPreference: "evening"` which in the 9–5 business grid means **late afternoon 3–5pm**, not after-hours. This aligns `rangeResolver.ts` and `filterRank.ts`.

Fixed in commit `4398e7b` after evening parsing conflicted with the business-hour grid.

---

## Duplicate Owner Map (Resolved)

| Previously duplicated | Now owned by |
|----------------------|--------------|
| Constraint parsing | `intentParser.ts` only |
| State mutation | `stateUpdate.ts` only |
| Second pass in service | Removed |
| `detectSchedulingConstraints` | Shim delegating to canonical path |
| Gate-planned availability overlay | `schedulingIntent.ts` → single apply in service |

**If you find two modules parsing the same scheduling constraint, that is a regression.**

---

## Test Coverage

| File | What it proves |
|------|----------------|
| `stateTransition.test.ts` | A–H matrix scenarios, PRESERVE/REPLACE/CLEAR, provider-truth invariants |
| `scheduling/service.test.ts` | Turn outcomes, copy builders |
| `schedulingBehavioralE2E.test.ts` | Multi-turn behavioral flows |
| `exactTimeBooking.integration.test.ts` | Booking path including deployed inbound mock |
| `deployedBoundarySmoke.test.ts` | Deterministic subset of boundary rules (local only unless HTTP flag set) |

**These do NOT prove deployed Twilio webhook behavior.** See `12-VALIDATION-PLAN.md`.
