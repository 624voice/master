# Phase C Workstream 3 — recovery / inbound ownership

Characterization of **current** behavior. Phase A/B design is not reopened.
No new product decisions. Legacy engine is still reachable — see
`docs/phase-c-legacy-migration.md`.

Tests: `src/server/sms/inboundRecovery.characterization.test.ts`.

| Case | Rebuilt engine | Legacy engine | vs Phase A/B | Phase C action |
|---|---|---|---|---|
| Expired AgentSession (14d TTL) | `getAgentSession` is null → `/api/sms/inbound` calls `handleInboundSms` | Unknown-inbound SMS if no legacy session | Reachable; Phase B listed retirement as a future pass | Open question 1. Untouched. |
| Lost / missing Redis | Same as missing session | Same | Consistent with current failover | Characterization only |
| Late reply, session exists | `handleAgentInboundSms` | Not used | Consistent with Phase A | Characterization only |
| Unknown inbound, no AgentSession | Not used | `unknownInboundMessage()` | Phase B: still reachable | Leave |
| Restarted conversation | `shouldSkipAgentOpener` blocks a non-terminal agent or legacy session | N/A | Consistent | Leave |
| STOP / START / HELP | Ingress; Twilio `OptOutType` → no app confirmation | App fallback confirmation only without `OptOutType` and without agent session | Consistent Phase A | Leave |
| Legacy ROI/contact inbound with old session | Not used | `unknownInboundMessage()` — does not `advanceConversation` | Consistent Phase B | Leave |

## Open questions (not decided here)

1. After AgentSession TTL expiry, should the prospect get legacy unknown-inbound, a new rebuilt opener, or silence?
2. After an `indeterminate` opener send-state (Workstream 1), should a later form POST be allowed to send a replacement opener?
3. Inbound `claimInboundMessageSid` skip-forever: a crash after SID claim and before the reply send still loses the reply. Changing that is an inbound-ownership redesign.

## Fixes in this workstream

None. Current behavior matches already-decided Phase A/B rules. Nothing here was a bug against those rules.
