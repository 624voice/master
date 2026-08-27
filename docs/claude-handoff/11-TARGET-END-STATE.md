# Target End State

## Ideal Agent Behavior

The finished Speed-to-Lead agent should feel like a **competent human scheduler who understands the prospect's business** — not a chatbot doing qualification theater.

---

## Conversation Flow (Target)

1. **ROI report delivered** — prospect receives personalized report link
2. **Agent asks one useful contextual question** — tied to what they flagged, not generic
3. **Optionally a second question** — only if 624Voice relevance still unclear (hard max 2)
4. **Reflects pain + consequence** — natural language, not robotic
5. **Makes outcome bridge** — conditional 25-minute ask without day/time in same message
6. **Prospect agrees** — meeting interest confirmed with context check
7. **Asks scheduling preference naturally** — code-owned deterministic ask
8. **Checks real Google calendar** — provider truth, never fabricated
9. **Handles scheduling language:**
   - Date ("Thursday", "Then Friday")
   - Daypart (morning, afternoon, evening)
   - Directional (earlier, later, before, after, between, around)
   - Exact times ("10am?", "What about 5?", "4?")
   - Rejection ("No 4pm")
   - Date changes (clears stale constraints)
   - Broadening/narrowing (clears incompatible state)
10. **Never fabricates availability**
11. **Never preserves stale incompatible state**
12. **Clear slot selection books immediately**
13. **Event appears on Google Calendar** (`info@624voice.com`)
14. **Google Meet URL created and persisted**
15. **Confirmation includes exact date/time/TZ/Meet link**
16. **24h + 2h reminders** with same Meet URL
17. **Reschedule/cancel work** via RESCHEDULE/CANCEL replies
18. **Post-book questions answered** without breaking booking state

---

## Scheduling Target Semantics

Every state transition must follow explicit PRESERVE / REPLACE / CLEAR:

| User intent | Expected behavior |
|-------------|-------------------|
| New date | Replace date, clear time constraints, invalidate offers |
| New daypart | Replace preference, clear exact/anchor/bounds, invalidate offers |
| New exact time | Replace exact, clear anchor/bounds, fresh provider check |
| Negation | Reject slot, clear matching exact, never book negated time |
| Broadening | Clear narrow constraints, fresh broader query |
| Slot selection from offers | Book immediately if provider confirms |

Request key must change when semantic truth changes. Offers must invalidate on key change.

---

## Booking Confirmation Target

```
Booked for [weekday], [month] [day] at [time] [TZ].
Here's the Google Meet link: [meet.google.com/...].
I'll send you reminders before we meet.
Need to change it? Reply RESCHEDULE or CANCEL.
```

Meet URL must never be stripped by URL policy.

---

## Fallback Link Target

Generic calendar link (`Jy8NRQgZrm5XFVRw9`) sent **only when:**
- Prospect explicitly asks for a link, OR
- Calendar unavailable after ≥2 attempts with no offered slots

**Never** on opening replies, report reactions, or pain identification.

---

## Reminder Target

- 24h: fires at T−24h or first cron after (never before T−24h)
- 2h: fires at T−2h or first cron after (never before T−2h)
- Same persisted Meet URL in all messages
- Cancelled/rescheduled appointments suppress reminders

---

## Non-Goals (Remain Out of Scope)

- Full prospect qualification over SMS
- Exact pricing quotes over SMS
- AI-as-primary-benefit messaging
- Multi-calendar provider support
- Complex multi-attendee scheduling
- After-hours consultations outside 9–5 grid

---

## READY Criteria

System is READY for production handset validation sign-off when:

1. Preview SHA verified at expected commit
2. A–H deployed-boundary sequence passes through signed webhook or real handset
3. Each A–H turn shows correct canonical state, request key, provider query, and SMS
4. No premature fallback links
5. No Meet URL stripping
6. No impossible internal bounds in state traces
7. Booking + Meet + confirmation proven on at least one A–H completion path
8. 2h reminder validated on a live booking (24h may be skipped for short lead-time)

---

## Architectural Target

```
ONE BEHAVIOR = ONE OWNER

Prompt  → judgment + natural language only
Code    → stage + state + truth + actions + invariants

Single scheduling parse owner
Single scheduling apply owner
Single URL classification owner
Single authoritative scheduling reply owner
```

Any deviation from this model is technical debt that will reproduce historical bugs.
