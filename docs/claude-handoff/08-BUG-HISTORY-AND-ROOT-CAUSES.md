# Bug History and Root Causes

Chronological table of major bugs encountered during the Speed-to-Lead build.

Status key: **Solved** | **Partial** | **Unresolved** | **Validation Pending**

---

## Bug Table

| ID | Phase / Date | Symptom | Root Cause | Fix | Result | Lesson |
|----|--------------|---------|------------|-----|--------|--------|
| A | Early 2026 | Scheduling state-machine instability; unpredictable transitions | Multiple overlapping state owners; prompt and code both interpreting scheduling | Consolidated orchestrator + scheduling gate architecture | Partial → architecture passes | One behavior = one owner |
| B | Discovery | Too many discovery questions (3+) | No hard cap; LLM asked freely | `discoveryProgress.ts` max 2 + guardrail | **Solved** | Cap in code, not prompt |
| C | Discovery → Scheduling | Stage regression back to discovery | Stage resolution didn't lock after scheduling entry | `conversationHandoff.ts`, stage guards | **Solved** | Stage is code-owned |
| D | Scheduling | Stale slot offers after date/preference change | Offers not invalidated on semantic change | `invalidateOffers`, request key change | **Solved** (7af6fb1) | Explicit invalidate semantics |
| E | Scheduling | Exact-time booking failures | Exact time not reaching provider query; overwritten by gate overlay | Fixed `availabilityInput` preserve in service | **Solved** | Single apply path |
| F | Scheduling | False "that time just got taken" | Stale state filtered valid slots; reported conflict without provider proof | State rewrite + provider-truth tests | **Solved** (7af6fb1) | Never trust NO_AVAILABILITY without provider proof |
| G | Calendar | Service account could read/create but not invite/Meet | Service account lacks DWD for attendees and Meet | Identified; planned OAuth migration | **Solved** (migration) | Auth mode must match capability needs |
| H | Calendar | Meet creation failure | Wrong conference payload type | Fixed to `hangoutsMeet` (`abd8ce9`) | **Solved** | Verify conference API response |
| I | Calendar | OAuth migration needed | Service account insufficient for production booking | OAuth user auth (`976a0da`) | **Solved** | OAuth smoke + booking smoke + handset |
| J | Booking | — | — | Full OAuth booking path | **Solved** — handset booking passed, Meet URL matched | End-to-end proof required |
| K | Reminders | 24h reminder sent ~1h early | Symmetric ± window around target | One-sided windows (`4332c2b`) | **Solved** (unit); old booking won't resend | Never early; bounded late catch-up only |
| L | Scheduling | Directional language failures ("earlier", "later", "before") | Incomplete bound parsing; conflicting modules | Expanded regex + single owner in intentParser | **Partial** | Directional = bound update, not selection |
| M | Scheduling | Thursday → Friday stale state contamination | Additive preserve semantics carried Thursday constraints to Friday | PRESERVE/REPLACE/CLEAR rewrite (`7af6fb1`) | **Solved** (unit) | Date change must clear incompatible state |
| N | Conversation | Missed direct customer questions | LLM turn task didn't prioritize FAQ during scheduling | `answer_customer_question` task + gate action | **Solved** | Answer first; state persists underneath |
| O | Conversation | Vague "holding it" / "I'll confirm" | LLM generated async language; no guardrail | Guardrail rejects pending-action language | **Solved** | No fake async |
| P | Deployment | Generic calendar fallback after "All of it" / "Missed calls" | Fallback eligibility too permissive; LLM sent link | `allowCalendarLinkFallback()` gates + URL policy | **Solved** | Fallback only after real failure |
| Q | Deployment | Preview serving older SHA than fix branch | Branch mismatch; PR #79 changes not in preview-61 | Deploy version health + merge discipline | **Solved** | Verify `/api/health` SHA before testing |
| R | Booking | Meet URL stripped from confirmation SMS | Single URL policy treated Meet like fallback | Typed `BOOKED_MEETING_LINK` vs `BOOKING_FALLBACK_LINK` | **Solved** | Semantic URL types, not one flag |
| S | Scheduling | Evening parsing conflict with 9–5 grid | "Evening" mapped outside business hours | Evening = late afternoon 3–5pm (`4398e7b`) | **Solved** | Product hours define daypart meaning |
| T | Scheduling | "No 4pm" parsed as 4pm request | Negation not checked before time extraction | `NEGATED_TIME_RE` + clear exact if negated | **Solved** (7af6fb1) | Negation before extraction |
| U | Scheduling | Exact → broad request didn't clear state | Broadening preserved exact/anchor/bounds | Broadening clears narrow constraints | **Solved** (7af6fb1) | Broader request clears narrower state |
| V | Scheduling | Friday morning filtered despite open Google calendar | Impossible bounds (`lo:960 > hi:720`) from additive state | State architecture rewrite | **Solved** (unit) | Impossible bounds = architecture bug |
| W | Architecture | Duplicate scheduling constraint owners | intentParser + detectSchedulingConstraints + service re-apply | Single owner in intentParser/stateUpdate | **Solved** (7af6fb1) | Audit owners after 2–3 failed patches |
| X | Architecture | State accumulated constraints additively | preserve/`??` default kept stale values | FieldUpdate PRESERVE/REPLACE/CLEAR model | **Solved** (unit) | Explicit mutation semantics |
| Y | Deployment | Unsigned `/api/sms/inbound` returns 403 | Twilio signature validation active on preview (NODE_ENV=production) | Not a bug — expected behavior | **Validation Pending** | Deployed boundary must use signed requests |

---

## Detailed Examples

### V — Friday Morning Filtered (Historical State Dump)

After A–H turn sequence, internal state looked like:

```
requestedDate: 2026-08-28
availabilityPreference: morning
exactTimeMinutes: 600      (stale 10am)
anchorTimeMinutes: 1020   (stale 5pm from Thursday)
lowerTimeBound: 960       (4pm)
upperTimeBound: 720       (noon)
```

Google returned Friday 9:00, 9:15, 10:00, 10:15, etc. Filter eliminated all due to impossible bounds.

### P — Premature Fallback

Turn: "All of it" (report reaction) → agent sent `calendar.app.google/...` link.

Gate now blocks: `allowCalendarLinkFallback()` false for opening replies (`deployedBoundarySmoke.test.ts` A–C).

### R — Meet URL Stripping

Turn: Booking confirmed → SMS: "Booked for Thu, Aug 28 at 10:00 AM CT. Here's the Google Meet link: https://meet.google.com/abc-defg-hij"

`finalizeCalendarLinkOutbound` stripped Meet URL because `calendarLinkAllowed=false` and no typed distinction existed.

---

## Live Eval Failures (Non-Blocking)

| Scenario | Issue | Status |
|----------|-------|--------|
| `demo-customization` | Unrelated to scheduling | Known unrelated |
| `sched-stress-friday-at-3` | Eval expects old anchor semantics for "Friday at 3" | Eval may need update post-7af6fb1 |

Live eval: 56/58 pass when `S2L_LIVE_EVAL=true`. Does not prove deployed boundary.

---

## Current Open Items

| ID | Status | Next Step |
|----|--------|-----------|
| Y | Validation Pending | A–H through signed webhook or handset |
| L | Partial | Validate directional language in A–H sequence |
| K (2h) | Validation Pending | Confirm 2h fires at T−2h on live booking |

Do not call system READY until Y is resolved.
