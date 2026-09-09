# Phase C Gate 1 audit

Baseline SHA: `b95d1b7cddc76855fd8c4962811b9eb592d88f88` (Phase B PR #92, frozen).

This document classifies current behavior. It does not invent product decisions.
Phase A/B architecture is not reopened.

Honest guarantee for Workstream 1: **effectively-once application behavior with
explicit visibility when the Redis + Twilio boundary makes the outcome
unknowable.** Not exactly-once delivery. Not perfect crash classification.

---

## 1A. Outbound send-path map

Sole Twilio SDK call: `src/server/sms/twilio.ts` `sendSms` → `client.messages.create`.
Wrappers: `sendConversationSms`, `sendLifecycleSms`. No other SMS HTTP adapter.

Classification is by the **code branch that executes**, not the conceptual
message category. Two independent dimensions: **Recipient** and **Send owner**.

### Prospect-facing, application-owned

| Path | File (send → persist) | Current ordering | Candidate key + stability proof | Verdict (pre-fix) |
|---|---|---|---|---|
| ROI opener | `agent/startConversation.ts` send then `saveAgentSession` | Send before session persist | Form POST has no durable webhook id. Two replays each mint their own report token. Stability requires atomically establishing the phone episode, then keying `agent-opener:{phone}`. Phone is the SMS identity; two POSTs for the same phone are one opener episode. Never `Date.now()`. | AT RISK |
| Contact opener | `agent/contactFlow/startConversation.ts` send then save | Send before persist | Same as ROI: no submission id. Key `agent-opener:{phone}` after the same episode rule. | AT RISK |
| Demo v2 opener | `agent/demoFlow/startConversation.ts` send then save; webhook `claimVapiCallId` NX skip-forever | Send before persist; webhook claim can silently lose the opener | `vapiCallId` is durable across webhook retries, but skip-forever before send is silent loss. Same-phone opener still uses `agent-opener:{phone}` so ROI/contact/demo cannot emit three openers. Webhook must not skip-forever before send-state. | AT RISK |
| Booking-link initial | `bookingLinkHandoff.ts` send then `enterBookingLinkPending` + save | Send before persist | Session already exists. `session.createdAt` is written at episode start and is identical across two meeting-intent inbounds that race the first handoff. Key `booking-link:{phone}:{createdAt}:initial`. Do not key on in-memory `bookingLinkSentAt` (generated per invocation). | AT RISK |
| Booking-link resend | `bookingLinkHandoff.ts` send then save `bookingLinkLastSentAt` | Send before persist | Each inbound retry of the same "send again" carries the same Twilio `MessageSid`. Key `booking-link:{phone}:{createdAt}:resend:{MessageSid}`. Without a SID there is no retry-stable id — tests/manual calls send without send-state. | AT RISK |
| Booking-link follow-up | `bookingLinkFollowUps.ts` send then save stage | Send before persist | Touch identity is `session.createdAt` + immutable `stageIndex`. Two overlapping 5-minute cron runs see the same due stage. Key `booking-link:{phone}:{createdAt}:fu:{stage}`. | AT RISK |
| No-response campaign | `noResponseCampaign.ts` send then save stage | Send before persist | `session.createdAt` + `noResponseStage`. Key `no-response:{phone}:{createdAt}:{stage}`. | AT RISK |
| Pain prompt | `painPrompt.ts` send then save resolved | Send before persist | One-shot per session. Key `pain-prompt:{phone}:{createdAt}`. | AT RISK |
| Abandoned demo recovery | `demoFlow/abandonedRecovery.ts` send then save stage | Send before persist | `DemoFormEntry.formSubmittedAt` is written once with the form. Key `abandoned-demo:{phone}:{formSubmittedAt}:{stage}`. | AT RISK |
| Lifecycle confirmation / reschedule confirmation | `processEvent.ts` `sendLifecycleMessageIfAllowed` then `saveLifecycleRecord` | Send before persist. Early-out on `confirmationSentAt` is post-send. | Google `calendarEventId` is the upstream durable id. Key `lifecycle:{eventId}:confirmation` / `:reschedule_confirmation`. | AT RISK |
| Reminders 24h / 2h | `processReminders.ts` send then save `reminder*SentAt` | Send before persist | `calendarEventId` + kind. Key `lifecycle:{eventId}:24h_reminder` / `:2h_reminder`. | AT RISK |
| Lifecycle inbound reschedule / cancel / cancel-manual | `appointmentLifecycle/handleInbound.ts` | Reschedule/cancel persist record **before** send; ack path sends then `saveSession` | Event id + message type for lifecycle SMS (`reschedule_link`, `cancellation`, `cancellation_manual`). Meeting-booked ack: inbound `MessageSid` when present, else one ack per phone. | AT RISK (ack); persist-before-send reduces but does not replace send-state for cancel/reschedule |
| Agent inbound reply | `agent/handleInbound.ts` `sendAgentReplySms` | `claimAgentOutboundForInbound(MessageSid)` NX then send (skip-forever) | Twilio `MessageSid` is supplied by the webhook and is identical on redelivery. Valid stability proof. Skip-forever can still silently lose a crash-after-claim. | SAFE key; skip-forever residual |
| Legacy inbound replies / unknown / opt-out fallback | `speed2Lead/handleInbound.ts`, ingress `sendLegacyOptOutConfirmation` | Mixed; unknown is send-only | When ingress has `MessageSid`, key `legacy-unknown:{sid}` / `legacy-opt-out:{sid}`. Twilio-classified `OptOutType` STOP/START/HELP does **not** send (provider-automatic). Application fallback STOP confirmation is application-owned. | AT RISK when app sends |
| Legacy nurture / demo follow-up / demo opener | `nurtureFollowUp.ts`, `demoSpeed2Lead/processFollowUps.ts`, `demoSpeed2Lead/startConversation.ts` | Send then persist | Nurture: `nurtureStartedAt` + stage. Demo FU: `demoCompletedAt` + stage. Legacy demo opener: `legacy-demo-opener:{phone}`. Flag-off / dead enroll for new leads (Phase B) but crons still exist. | AT RISK if path executes |

### Internal / operator, application-owned

| Path | Ordering | Key / proof | Verdict | Scope |
|---|---|---|---|---|
| `sendHumanAlert` | Redis NX `speed2lead:human-alert:{reason}:{subjectId}` then send | `reason` + `subjectId` (phone or calendar event id) is the logical incident. Two `HUMAN_FOLLOW_UP` alerts for the same prospect are the reliability bug. | Event-level dedupe present. Crash after NX before send can lose the alert (acceptable: spec does not require the full lease machine). | Dedupe only |

### Provider-automatic (observe only)

| Path | Branch | Owner |
|---|---|---|
| Twilio Advanced Opt-Out STOP/START/HELP | `handleIngressCompliance` when `OptOutType` is present → `sendLegacyConfirmation: false` | Provider/carrier confirmation. **Do not** add application send-state around these. |

### Human-authored

Out of scope (operator console / Twilio console). None in this repo.

### SAFE reference (not automatically transferable)

`claimAgentOutboundForInbound` / `claimInboundMessageSid` keyed on Twilio `MessageSid`.
Valid because the upstream trigger supplies the durable id. Each other trigger
type needs its own proof (table above).

### Cron overlap (add locks only where overlap is material)

Evidence: `speed2lead-followups` every 5 minutes; `appointment-calendar-sync`
every 10 minutes; `appointment-reminders` every 15 minutes. A run that includes
Google list + per-event SMS can exceed the interval; HTTP cron retries can
double-fire. Locks added on those workers are **defense-in-depth / operational
efficiency only**. The per-logical-event send-state record is the correctness
boundary.

---

## 1B. Test-suite isolation root causes

`bun test src` on the Phase B SHA, with ambient Cloud Agent env (including
`SPEED2LEAD_TEST_PHONES` and live Google/Twilio credentials):

| Category | Examples | Disposition |
|---|---|---|
| Environment pollution | `smsEligibility` / consent tests, `shouldSkipAgentOpener` when allowlist/env differ from CI | Fixture the env in the test file; do not change assertions |
| Live-network dependency | Calendar 401s, Google OAuth/booking smokes, any test that calls real Twilio | Split to `*.smoke.test.ts`; default `bun test src` stays offline |
| Shared mutable Redis mock | `matchLead.test.ts` private redis mock vs `integrationMocks.ts` | Keep both NX-correct; isolate stores |
| Ordering / module-load profile | `DEFAULT_624VOICE_PROFILE.humanEscalationConfig.phone` captured at import | Document; don't rewrite profile for its own sake |
| Typecheck already failing on master | Unrelated to Phase C | Out of scope |

Workstream 2 rule: never change what a live-behavior test asserts — only the
environment / fixture / mocking layer.

---

## 1C. Recovery / inbound ownership (current behavior)

Legacy engine is **still reachable**: `/api/sms/inbound` routes to
`handleInboundSms` when `getAgentSession(phone)` is null. Phase B did not
retire it. **No deletion in Phase C** — migration-plan document only
(`docs/phase-c-legacy-migration.md`).

| Case | Rebuilt engine | Legacy engine | vs Phase A/B | Action |
|---|---|---|---|---|
| Expired AgentSession (14d TTL) | `getAgentSession` null → legacy handler | Unknown-inbound SMS if no legacy session | Reachable; Phase B listed retirement as a future pass | Open question: what should an expired rebuilt session receive? Do not decide here. |
| Lost / missing Redis | Same as missing session | Same | Consistent with current failover | Characterization tests only |
| Late reply, session exists | Rebuilt `handleAgentInboundSms` | N/A | Consistent with Phase A | Characterization tests |
| Unknown inbound, no AgentSession | N/A | `unknownInboundMessage()` | Phase B: still reachable | Leave; do not delete |
| Restarted conversation | `shouldSkipAgentOpener` blocks if a non-terminal agent/legacy session exists | N/A | Consistent | Leave |
| STOP / START / HELP | Ingress compliance; Twilio-classified = no app confirmation | App fallback confirmation only without `OptOutType` and without agent session | Consistent Phase A | Leave |
| Legacy ROI/contact inbound with old session | Not used | `unknownInboundMessage()` — does not `advanceConversation` | Consistent Phase B | Leave |

### Open questions (not decided in Phase C)

1. After AgentSession TTL expiry, should the prospect get legacy unknown-inbound, a new rebuilt opener, or silence?
2. After `indeterminate` opener (session saved, SMS maybe delivered), should a later form POST be allowed to send a replacement opener? Current send-state leaves it indeterminate (no automatic resend).
3. Inbound `claimInboundMessageSid` skip-forever: a crash after SID claim and before the reply send still loses the reply. Fixing that is an inbound-ownership redesign — out of scope.

---

## 1D

See `docs/shared-core-boundary.md`.
