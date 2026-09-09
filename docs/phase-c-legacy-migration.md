# Legacy engine migration plan (Phase C — document only)

The rebuilt agent (`speed2Lead/agent/*`) is the production conversation engine
for ROI, Contact, and Demo when an `AgentSession` exists.

The legacy engine (`speed2Lead/handleInbound.ts`, `demoSpeed2Lead/*`,
`nurtureFollowUp.ts`) is **still reachable** and must not be deleted in this
sprint.

## Reachability proof (why retirement is blocked)

`src/routes/api/sms/inbound.ts`:

- If `getAgentSession(phone)` is truthy → `handleAgentInboundSms`.
- Else → `handleInboundSms` (legacy).

That branch is live whenever:

- the phone never started a rebuilt conversation, or
- the 14-day AgentSession TTL expired, or
- Redis state was lost, or
- a test/reset cleared the agent session but not a legacy session.

Phase B already stopped **new** conversational slot booking and stopped
enrolling new leads onto legacy nurture. It did not prove non-reachability.

Until inbound routing never calls `handleInboundSms`, deletion would change
recovery behavior for expired/missing sessions — an undecided product question
(see Gate 1C and `docs/phase-c-recovery-cases.md`).

## What "retired" would require (future sprint)

1. Product decision on expired / missing AgentSession (open question 1C.1 /
   recovery-cases question 1).
2. Inbound router no longer imports `handleInboundSms`.
3. Characterization suite proving no production phone can hit legacy replies.
4. Only then delete or stub legacy send paths.
5. Keep Phase B TTL-compat fields (`offering_slots` / `confirming` and slot
   preference fields) until that 14-day window has actually expired — not part
   of this plan.

## Phase C work

- Document current behavior.
- Add characterization tests for the reachable cases.
- Do not delete legacy modules, crons, or copy.
