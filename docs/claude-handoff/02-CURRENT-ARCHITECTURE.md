# Current Technical Architecture

## Runtime Path (Exact)

```
Twilio inbound SMS
  → POST /api/sms/inbound          (src/routes/api/sms/inbound.ts)
  → isValidTwilioWebhook()         (src/server/sms/twilio.ts)
  → handleInboundSms()             (src/server/speed2Lead/handleInbound.ts)
  → getSession / saveSession       (src/server/speed2Lead/session.ts → Upstash Redis)
  → orchestrateInboundTurn()       (src/server/speed2Lead/orchestrator.ts)
       ├─ resolveTurnSemantics()   (src/server/speed2Lead/turnSemantics.ts)
       ├─ applyMeetingBridgeProgress() (src/server/speed2Lead/conversationHandoff.ts)
       ├─ resolveDispositionAfterInbound() (src/server/speed2Lead/conversationDisposition.ts)
       ├─ advanceDiscoveryOnInbound() (src/server/speed2Lead/discoveryProgress.ts)
       ├─ prepareInboundSchedulingTurn() (src/server/speed2Lead/schedulingIntent.ts)
       ├─ planSchedulingGate()      (src/server/speed2Lead/schedulingGate.ts)
       ├─ [optional] LLM loop       (OpenAI Responses API via prompts.ts)
       ├─ enforceSchedulingGate()   → processSchedulingTurn() (src/server/scheduling/service.ts)
       │     → queryProviderAvailability() (src/server/scheduling/provider.ts)
       │     → getConsultationSlots() (src/server/appointmentLifecycle/googleCalendar.ts)
       │     → bookProviderSlot() → bookConsultation()
       ├─ resolveAuthoritativeSchedulingReply()
       ├─ validateOutboundSms()     (src/server/speed2Lead/guardrails.ts)
       └─ finalizeCalendarLinkOutbound() (src/server/speed2Lead/guardrails.ts)
  → sendSms()                      (src/server/sms/twilio.ts)
```

Parallel path for self-scheduled bookings detected via Apps Script / API sync:
`processEvent()` → `handleInbound.ts` (lifecycle) → reminder cron

## Owner Map

### LLM Owns

| Responsibility | Notes |
|----------------|-------|
| Natural language wording | One SMS, ≤320 chars |
| Contextual acknowledgment | Report reaction, brief replies |
| Pain/consequence articulation | Via `outcomeBridgeContext` guidance |
| Bridge question wording | Must not ask day/time in bridge turn |
| Answering normal prospect questions | FAQ, product scope — using `allowedFacts` |
| `update_known_facts` tool | Optional fact extraction |

### Code Owns

| Responsibility | Primary files |
|----------------|---------------|
| Conversation stage | `conversationStage.ts` |
| Discovery count / phase | `discoveryProgress.ts` |
| Meeting interest flag | `meetingInterest.ts`, `conversationHandoff.ts` |
| Scheduling entry legality | `conversationHandoff.ts`, `schedulingGate.ts` |
| Scheduling state mutations | `intentParser.ts`, `stateUpdate.ts` |
| Request keys | `requestKey.ts` |
| Provider truth | `provider.ts`, `googleCalendar.ts` |
| Slot filter/rank | `filterRank.ts`, `rangeResolver.ts` |
| Exact-time check / booking | `service.ts`, `bookConsultation.ts` |
| Meet URL persistence | `memory.ts`, session scheduling fields |
| Reminders | `reminderSchedule.ts`, `processReminders.ts` |
| Fallback link eligibility | `schedulingGate.ts` → `allowCalendarLinkFallback()` |
| URL classification | `outboundPolicy.ts` |
| Session identity | `session.ts` |
| Outbound guardrails | `guardrails.ts` |
| Authoritative scheduling SMS | `scheduling/service.ts` → `buildReplyFromSchedulingResult()` |

## Design Principle

**ONE BEHAVIOR = ONE OWNER**

If scheduling state, provider truth, or booking eligibility appears in both prompt and code, that is a bug waiting to happen.

## LLM Enablement

Controlled by:
- `SPEED2LEAD_LLM_ENABLED` env
- `SPEED2LEAD_TEST_PHONES` allowlist on preview (`testPhoneAllowlist.ts`)

Phones not on allowlist use rules-based fallback (`stateMachine.ts`).

Model default: `gpt-4.1-mini` (`config.ts`).

## Deterministic Scheduling Override

When `enforceSchedulingGate()` runs with a scheduling action, **`resolveAuthoritativeSchedulingReply()` wins** over LLM text for availability, booking confirmation, and scheduling failures.

The LLM is intentionally told: **"No calendar times, bookings, or links"** in orchestrator instructions.

## State Persistence Layers

| Layer | Storage | Scope |
|-------|---------|-------|
| S2L session | Redis `speed2lead:session:{phone}` | Conversation + scheduling state |
| Appointment lifecycle | Redis `appointment:lifecycle:{eventId}` | Bookings, reminders |
| OAuth connection | Redis `google:oauth:connection:{id}` | Calendar auth |
| Opt-out | Redis `speed2lead:optout:{phone}` | STOP handling |

## Deployment

- **Platform:** Netlify (functions + SPA)
- **Preview-61:** Deploy preview for PR #61 branch `cursor/llm-orchestrator-537c`
- **Health:** `GET /api/health` → `buildDeployVersionInfo()` (`deployVersion.ts`)
- **Twilio webhook URL (preview):** `https://deploy-preview-61--624voice.netlify.app/api/sms/inbound` (`netlify.toml`)

## Related Architecture Docs (Existing)

- `docs/speed2lead-setup.md` — env vars, Redis
- `docs/appointment-lifecycle-setup.md` — lifecycle, OAuth, cron
