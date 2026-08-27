# Validation Plan

## Test Layers

Each layer proves different things. **None alone is sufficient for READY.**

```
Unit / Integration  →  internal behavior correctness
Live Eval           →  model + orchestrator behavior in eval environment
Deployed Boundary   →  Netlify + Twilio webhook + runtime behavior
Handset             →  final real-world proof
```

---

## Layer 1: Unit / Integration Tests

**Command:** `bun test` (or `npm test`)

| Metric | Current |
|--------|---------|
| Pass | 657 |
| Skip | 1 (live eval) |
| Fail | 0 |
| Files | 62 |

### What It Proves

- PRESERVE/REPLACE/CLEAR semantics
- Intent parsing for A–H scenarios
- Provider-truth invariants
- Guardrails and URL policy
- OAuth flow logic
- Reminder eligibility windows
- Session isolation

### What It Does NOT Prove

- Twilio signature validation on preview
- Netlify runtime env var resolution
- Real Google Calendar API responses in production
- Model behavior with live OpenAI
- Deployed SHA matches local branch

---

## Layer 2: Live Eval

**File:** `src/server/speed2Lead/eval/liveEval.test.ts`

**Enable:** `S2L_LIVE_EVAL=true` + `OPENAI_API_KEY`

**Safety note** (`eval/environmentSafety.ts`): Calls `orchestrateInboundTurn()` directly — never `handleInboundSms()`, `saveSession()`, or Twilio send paths.

### What It Proves

- Live model follows prompt guidance for discovery/bridge
- Orchestrator repair loops work with real OpenAI
- Scenario-based conversation quality

### What It Does NOT Prove

- Deployed webhook boundary
- Scheduling provider integration (mocked in most scenarios)
- Twilio outbound delivery
- Redis persistence in production

**Last known:** 56/58 pass. Failures: `demo-customization` (unrelated), `sched-stress-friday-at-3` (may need eval update post-7af6fb1).

---

## Layer 3: Deployed Boundary

**Purpose:** Prove actual Netlify/Twilio/webhook/runtime behavior.

**Endpoint:** `POST https://deploy-preview-61--624voice.netlify.app/api/sms/inbound`

**Requires:** Valid Twilio signature OR real handset traffic.

**Optional local subset:** `deployedBoundarySmoke.test.ts` (deterministic, no HTTP unless `RUN_DEPLOYED_BOUNDARY_HTTP=true`)

### What It Proves

- Correct SHA deployed
- Twilio webhook processes end-to-end
- Session persistence in production Redis
- Real scheduling state mutations through full inbound path
- Outbound SMS sent via Twilio

### What It Does NOT Prove

- Every scheduling scenario (only what's tested)
- Production domain (preview only)
- Long-running reminder cron (separate validation)

---

## Layer 4: Handset

**Purpose:** Final real-world proof with actual SMS UX.

**Requirements:**
- Phone in `SPEED2LEAD_TEST_PHONES` allowlist on preview
- Session cleared before test (`scripts/reset-s2l-test-phone.ts`)
- Preview SHA verified via `/api/health`

### What It Proves

- Complete user experience
- SMS delivery timing and formatting
- Google Calendar event + Meet link in confirmation
- Reminder delivery (with time)

---

## A–H Deployed-Boundary Sequence

**Required before READY.** Must go through the same public preview `/api/sms/inbound` endpoint Twilio uses.

Assume starting from fresh ROI session with meeting interest confirmed and scheduling entered. Use Thursday 2026-08-27 as reference date (matches test fixtures).

| Step | Inbound Message | Expected Semantics |
|------|-----------------|-------------------|
| **A** | "Evenings work better" (on Thursday) | Evening preference = late afternoon 3–5pm within 9–5 grid. Provider queried for Thursday evening window. |
| **B** | "What about 5?" | Fresh exact 5pm check. Replace any prior exact. Clear stale evening bound if incompatible. |
| **C** | "4?" | Replace 5pm with 4pm exact. Fresh 4pm provider check. |
| **D** | "No 4pm" | Reject 4pm — NOT selection. Clear exact 4pm. Add to rejected slots. Never book 4pm. |
| **E** | "Then Friday" | New Friday date. Clear ALL stale Thursday constraints (exact, anchor, bounds, rejected). Invalidate offers. |
| **F** | "Need a morning time on Friday" | Morning daypart replaces incompatible exact/anchor/bounds. Fresh Friday morning query. |
| **G** | "10am?" | Exact 10am on Friday. Fresh provider check for Friday 10:00. |
| **H** | "What morning times do you have on Friday?" | Broaden to Friday morning. Clear exact 10am. Return real morning slots from provider. |

### Per-Turn Inspection Checklist

For every turn, capture and verify:

1. **Canonical state** — all scheduling fields in session after turn
2. **Request key** — matches semantic intent
3. **Provider invoked** — yes/no, which function
4. **Provider query range** — date + time window
5. **Raw provider slots** — what Google returned
6. **Filtered slots** — after filterRank + rejected slot filter
7. **Final SMS** — authoritative scheduling reply content

Red flags:
- `lowerTimeBound > upperTimeBound`
- Stale exact/anchor from prior date
- NO_AVAILABILITY without empty provider response
- Generic calendar fallback link
- Meet URL stripped from confirmation

---

## Test Inventory by Category

| Category | Key Files | Count (approx) |
|----------|-----------|----------------|
| Scheduling core | `stateTransition.test.ts`, `service.test.ts`, `schedulingOrchestration.test.ts` | ~50 |
| Scheduling E2E | `schedulingBehavioralE2E.test.ts`, `schedulingConversation.test.ts` | ~55 |
| Integration | `exactTimeBooking.integration.test.ts`, `conversionSchedulingHardening.integration.test.ts`, `architectureConsolidation.integration.test.ts` | ~60 |
| Orchestrator | `orchestrator.test.ts` | 24 |
| Calendar/OAuth | `googleOAuth.test.ts`, `googleCalendar.consultation.test.ts`, `googleMeetBooking.test.ts` | ~40 |
| Reminders | `reminderSchedule.test.ts` | 23 |
| Lifecycle | `zz-lifecycle.integration.test.ts` | varies |
| Guardrails | `bookingSafety.test.ts`, `customerQuestions.test.ts` | ~20 |
| Deployed smoke | `deployedBoundarySmoke.test.ts` | 5 |
| Live eval | `eval/liveEval.test.ts` | 58 scenarios |
| Allowlist | `testPhoneAllowlist.test.ts` | 21 |

---

## Cron / Smoke Diagnostics

| Endpoint | Purpose |
|----------|---------|
| `/api/cron/calendar-oauth-smoke` | OAuth token valid |
| `/api/cron/calendar-capability-smoke` | Calendar read capability |
| `/api/cron/calendar-booking-smoke` | End-to-end book + Meet |
| `/api/cron/calendar-provider-smoke` | Provider slot query |
| `/api/cron/appointment-reminders` | Reminder cron processor |

These validate infrastructure, not conversation scheduling state.

---

## Pre-Validation Checklist

Before running A–H:

- [ ] Confirm `/api/health` SHA = `7af6fb1`
- [ ] Confirm preview branch = `cursor/llm-orchestrator-537c`
- [ ] Clear test phone session
- [ ] Confirm phone in `SPEED2LEAD_TEST_PHONES`
- [ ] Confirm OAuth connection active for `info@624voice.com`
- [ ] Choose validation method: handset SMS (recommended) or signed HTTP

---

## Post-Validation Decision Tree

| A–H Result | Action |
|------------|--------|
| All turns pass | Proceed to booking completion test + reminder validation |
| State corruption found | Architecture audit — do NOT phrase-patch |
| Provider empty but calendar open | Provider/query bug — inspect range resolver |
| 403 on inbound | Expected for unsigned — use handset or signing |
| Fallback link too early | Inspect `allowCalendarLinkFallback()` conditions |
| Meet URL stripped | Inspect URL classification — regression on bug R |

Do not merge to master or call READY until deployed boundary passes.
