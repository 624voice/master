# File Map

Practical reference for important files. For each: PATH, PURPOSE, OWNER, RISK OF CHANGING, RELATED TESTS.

---

## Inbound Webhook

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/routes/api/sms/inbound.ts` | POST handler for Twilio SMS webhook | Infrastructure | **High** — production entry point | `exactTimeBooking.integration.test.ts` (deployed path) |
| `src/server/speed2Lead/handleInbound.ts` | Session load, orchestrate, send SMS | Orchestration | **High** | Multiple integration tests |
| `src/server/sms/twilio.ts` | Signature validation, SMS send | Infrastructure | **High** — security boundary | None dedicated |
| `src/server/sms/phone.ts` | Phone normalization | Utility | Low | Various |

---

## Orchestrator

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/orchestrator.ts` | `orchestrateInboundTurn()` — main turn loop | Orchestration | **High** | `orchestrator.test.ts` (24) |
| `src/server/speed2Lead/turnSemantics.ts` | Turn classification | Code | Medium | Integration tests |
| `src/server/speed2Lead/turnRecovery.ts` | Failed turn recovery | Code | Medium | `turnRecovery` tests |
| `src/server/speed2Lead/tools.ts` | Tool execution state | Code | Medium | Orchestrator tests |

---

## Prompts and Business Context

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/prompts.ts` | `buildOrchestratorInstructions()` | Prompt assembly | **High** — affects all LLM turns | Live eval |
| `src/server/speed2Lead/businessContext.ts` | Product facts, bridge context, guardrail facts | Product config | Medium | `businessContext` usage in guardrails |
| `src/server/speed2Lead/conversationStage.ts` | Stage resolution, LLM task selection | Code | **High** | Stage tests |
| `src/server/speed2Lead/stateMachine.ts` | Rules-based fallback (non-LLM phones) | Code | Medium | Integration |

---

## Conversation Stage / Discovery

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/discoveryProgress.ts` | Discovery count, phase advancement | Code | **High** | Discovery integration tests |
| `src/server/speed2Lead/conversationHandoff.ts` | Bridge progress, scheduling entry | Code | **High** | Handoff integration tests |
| `src/server/speed2Lead/conversationDisposition.ts` | Active/booked/declined disposition | Code | Medium | Integration |
| `src/server/speed2Lead/meetingInterest.ts` | Meeting interest flag | Code | **High** | Conversion tests |
| `src/server/speed2Lead/customerQuestions.ts` | FAQ answer helpers | Code | Medium | `customerQuestions.test.ts` |

---

## Scheduling Gate

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/schedulingGate.ts` | Gate planning, enforcement, authoritative reply | Code | **Critical** | `schedulingController.test.ts` (18) |
| `src/server/speed2Lead/schedulingController.ts` | Re-export shim for schedulingGate | Compatibility | Low | Same |
| `src/server/speed2Lead/schedulingIntent.ts` | `prepareInboundSchedulingTurn()` | Code | **High** | Integration |
| `src/server/speed2Lead/schedulingContext.ts` | Legacy shim, slot selection, filter helpers | Code | **High** | State transition tests |
| `src/server/speed2Lead/schedulingReply.ts` | Slot offer message builders | Code | Medium | Scheduling tests |

---

## Scheduling Core

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/scheduling/intentParser.ts` | **Canonical** NL → state update | Code | **Critical** | `stateTransition.test.ts` (16) |
| `src/server/scheduling/stateUpdate.ts` | **Canonical** PRESERVE/REPLACE/CLEAR apply | Code | **Critical** | `stateTransition.test.ts` |
| `src/server/scheduling/state.ts` | Legacy ↔ canonical mapping, request build | Code | **Critical** | Service tests |
| `src/server/scheduling/service.ts` | `processSchedulingTurn()` — turn processor | Code | **Critical** | `service.test.ts` (18) |
| `src/server/scheduling/requestKey.ts` | Request fingerprint | Code | **High** | State transition tests |
| `src/server/scheduling/rangeResolver.ts` | Date/daypart → query window | Code | **High** | Provider tests |
| `src/server/scheduling/filterRank.ts` | Post-provider slot filter/rank | Code | **High** | Service tests |
| `src/server/scheduling/provider.ts` | Provider adapter | Code | **High** | Provider smoke |
| `src/server/scheduling/types.ts` | Canonical types | Types | Medium | All scheduling tests |

---

## Calendar / OAuth / Booking

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/appointmentLifecycle/googleCalendar.ts` | Slots, events, Meet, idempotency | Provider | **Critical** | `googleCalendar.consultation.test.ts` |
| `src/server/appointmentLifecycle/googleCalendarAuth.ts` | Auth mode resolution | Infrastructure | **High** | OAuth tests |
| `src/server/appointmentLifecycle/googleOAuthFlow.ts` | OAuth start/callback/refresh | Infrastructure | **High** | `googleOAuth.test.ts` (16) |
| `src/server/appointmentLifecycle/googleOAuthStore.ts` | Redis token storage | Infrastructure | **High** | OAuth tests |
| `src/server/appointmentLifecycle/googleMeetConference.ts` | Meet conference payload | Provider | **High** | `googleMeetConference.test.ts` |
| `src/server/appointmentLifecycle/bookConsultation.ts` | Agent booking entry | Provider | **Critical** | `googleMeetBooking.test.ts` |
| `src/server/appointmentLifecycle/consultationSlots.ts` | Slot grid generation | Provider | **High** | Consultation tests |
| `src/server/appointmentLifecycle/consultationConfig.ts` | TZ, duration, buffer config | Config | Medium | Config tests |
| `src/server/appointmentLifecycle/config.ts` | Env config, booking URL | Config | Medium | Config tests |
| `src/server/appointmentLifecycle/processEvent.ts` | Post-book lifecycle | Lifecycle | **High** | Lifecycle integration |
| `src/server/appointmentLifecycle/messages.ts` | Confirmation/reminder copy | Copy | Medium | `messages.test.ts` |

---

## Outbound Policy / Guardrails

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/outboundPolicy.ts` | URL classification, question counting | Code | **High** | Policy tests |
| `src/server/speed2Lead/guardrails.ts` | `validateOutboundSms()`, link finalization | Code | **High** | `bookingSafety.test.ts` |

---

## Lifecycle / Reminders

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/appointmentLifecycle/reminderSchedule.ts` | Eligibility windows | Code | **High** — recently fixed | `reminderSchedule.test.ts` (23) |
| `src/server/appointmentLifecycle/processReminders.ts` | Cron processor | Lifecycle | **High** | Lifecycle integration |
| `src/server/appointmentLifecycle/store.ts` | Lifecycle Redis CRUD | Persistence | **High** | Store tests |
| `src/server/appointmentLifecycle/intents.ts` | RESCHEDULE/CANCEL detection | Code | Medium | Intent tests |
| `src/routes/api/cron/appointment-reminders.ts` | Cron HTTP endpoint | Infrastructure | **High** | Cron tests |

---

## Session / Persistence

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/session.ts` | Session CRUD | Persistence | **High** | Session tests |
| `src/server/speed2Lead/memory.ts` | Scheduling memory helpers | Persistence | **High** | Integration |
| `src/server/speed2Lead/sessionMemoryTypes.ts` | Type definitions | Types | Medium | Compile-time |
| `src/server/speed2Lead/redis.ts` | Upstash client | Infrastructure | **High** | Integration |
| `src/server/speed2Lead/resetTestPhone.ts` | Test phone cleanup | Testing | Low | Manual |
| `src/server/speed2Lead/testPhoneAllowlist.ts` | Preview allowlist | Config | Medium | `testPhoneAllowlist.test.ts` (21) |

---

## Config / Features

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/config/features.ts` | Booking URLs, site origin | Product config | Medium | Feature tests |
| `src/server/speed2Lead/config.ts` | S2L env config, model | Config | Medium | Config tests |
| `src/server/deployVersion.ts` | Health/deploy metadata | Infrastructure | Low | `deployVersion.test.ts` |
| `netlify.toml` | Deploy config, webhook paths | Infrastructure | **High** | Deploy smoke |

---

## Live Eval

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/eval/liveEval.test.ts` | Live model eval suite | QA | Low (gated) | Self |
| `src/server/speed2Lead/eval/scenarios.ts` | Eval scenario definitions | QA | Low | Live eval |
| `src/server/speed2Lead/eval/environmentSafety.ts` | Eval safety guards | QA | Low | Live eval |

---

## Deployed Boundary

| Path | Purpose | Owner | Risk | Tests |
|------|---------|-------|------|-------|
| `src/server/speed2Lead/deployedBoundarySmoke.test.ts` | Boundary regression subset | QA | Low | Self (5 tests) |

---

## Scripts

| Path | Purpose |
|------|---------|
| `scripts/reset-s2l-test-phone.ts` | Clear test phone session |
| `scripts/calendar-booking-smoke.ts` | Manual booking smoke |
| `scripts/calendar-availability-smoke.ts` | Manual availability smoke |

---

## Existing Docs

| Path | Purpose |
|------|---------|
| `docs/speed2lead-setup.md` | Env vars, Redis setup |
| `docs/appointment-lifecycle-setup.md` | Lifecycle, OAuth, cron (note: legacy calendar URL) |
| `docs/claude-handoff/` | This handoff package |
