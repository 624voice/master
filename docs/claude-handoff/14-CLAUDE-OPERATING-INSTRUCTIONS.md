# Claude Operating Instructions

## DO NOT START BY CHANGING CODE

Read this entire handoff package before proposing any implementation.

---

## First Steps (In Order)

### 1. Read Every Handoff Document

Start at `00-START-HERE.md`, then read 01–13 in order. Reference `CLAUDE-MASTER-CONTEXT.md` for consolidated view.

### 2. Inspect Current Branch and Commit

```bash
git branch --show-current
git log -1 --oneline
git status
```

Expected:
- Branch: `cursor/llm-orchestrator-537c`
- Commit: `7af6fb1` (full: `7af6fb1bd82c6f1195c748a562227f0293346bb3`)

### 3. Compare Documentation to Actual Repo

Spot-check these files match handoff claims:
- `src/server/scheduling/stateUpdate.ts` — FieldUpdate model exists
- `src/server/scheduling/intentParser.ts` — single parse owner
- `src/server/scheduling/service.ts` — no second constraint pass
- `src/server/speed2Lead/outboundPolicy.ts` — typed URL kinds
- `src/config/features.ts` — `Jy8NRQgZrm5XFVRw9` fallback URL

### 4. Confirm Scheduling Owner Model

| Behavior | Owner file |
|----------|-----------|
| Parse inbound scheduling language | `intentParser.ts` |
| Apply state mutations | `stateUpdate.ts` |
| Process turn + provider + booking | `service.ts` |
| Gate orchestration | `schedulingGate.ts` |
| Authoritative scheduling SMS | `service.ts` + `schedulingGate.ts` |
| URL classification | `outboundPolicy.ts` |

If you find two owners for the same behavior → architecture regression.

### 5. Confirm 7af6fb1 Architecture State

Run tests:
```bash
bun test
```

Expected: 657 pass, 1 skip, 0 fail.

Run scheduling-specific:
```bash
bun test src/server/scheduling/stateTransition.test.ts
```

Expected: 16 pass (A–H matrix scenarios).

### 6. Confirm Preview-61 Deploy Identity

```bash
curl -s https://deploy-preview-61--624voice.netlify.app/api/health | jq .
```

Verify `gitCommitSha` starts with `7af6fb1`.

### 7. Confirm Twilio Signature Blocker

Unsigned POST to preview inbound returns 403. This is **expected and correct**.

Do NOT disable signature validation.

Validation code: `src/server/sms/twilio.ts` → `isValidTwilioWebhook()`

### 8. Review Deployed-Boundary Test Harness

- Local deterministic subset: `src/server/speed2Lead/deployedBoundarySmoke.test.ts`
- Full HTTP health check: set `RUN_DEPLOYED_BOUNDARY_HTTP=true`
- Integration mock of deployed path: `exactTimeBooking.integration.test.ts` → "deployed Twilio inbound path"

**No repo tool generates Twilio signatures for preview.** Real handset SMS is the lowest-risk A–H method.

### 9. Recommend Lowest-Risk A–H Execution

Recommended approach:
1. Clear test phone: `bun run scripts/reset-s2l-test-phone.ts +12148438991`
2. Verify preview SHA
3. Send A–H messages from handset (allowlisted number)
4. Capture server-side state via logging or Redis inspection if available
5. Document each turn's state + SMS

Alternative: build signing harness using Twilio auth token (requires secure env access, not in repo).

### 10. Only After Deployed-Boundary Evidence

If A–H passes → recommend broader handset validation + booking completion test.

If A–H fails → architecture audit first. Do NOT phrase-patch.

---

## What NOT to Change Without Explicit Approval

- OAuth credentials / Google OAuth flow
- Google Meet creation logic
- Reminder timing windows (recently fixed)
- Production/preview Twilio webhook signature validation
- Merging to `master`
- Transcript-specific behavioral patches
- Prompt scheduling rules (code owns scheduling)
- Production config / env vars on Netlify

---

## Architectural Principles

1. Architecture before patch.
2. One behavior = one owner.
3. Prompt for judgment/language.
4. Deterministic code for state/truth/actions.
5. Never solve transcript failures with transcript-specific rules.
6. Never trust NO_AVAILABILITY without provider proof.
7. Scheduling updates need explicit preserve/replace/clear semantics.
8. Negation must be understood before time extraction.
9. A broader scheduling request must clear narrower incompatible state.
10. Calendar-link fallback is not the scheduling engine.
11. Persisted Google Meet URL is trusted booked-meeting data.
12. No fake async.
13. No booking without concrete provider-backed time.
14. Do not call READY until deployed boundary is proven.
15. After 2–3 fixes in the same subsystem, stop and audit architecture.
16. Every meaningful change should include pre-change contradiction audit, implementation, post-change bloat/duplication audit.

---

## Change Workflow (When Approved)

1. Create branch: `cursor/<descriptive-name>-537c`
2. Pre-change audit: document current owners and contradictions
3. Implement minimal fix
4. Add/update tests in appropriate layer
5. Run full test suite
6. Push and deploy to preview-61
7. Verify `/api/health` SHA
8. Run deployed-boundary validation (not just unit tests)
9. Update handoff docs if architecture changed

---

## Escalation Triggers

Stop coding and audit architecture if:
- Same bug category fails after 2–3 fix attempts
- Fix requires adding scheduling rules to prompt
- Fix requires second parsing pass
- Fix is specific to one handset transcript phrase
- Impossible bounds appear in state (`lower > upper`)
- Preview SHA doesn't match expected commit

---

## Key Contacts / Resources

- Preview: `https://deploy-preview-61--624voice.netlify.app`
- Health: `/api/health`
- Inbound webhook: `/api/sms/inbound`
- OAuth setup: `/setup/google-calendar`
- Test phones: `+12148438991`, `+18178544399` (allowlisted on preview)

Do not expose secrets (Twilio auth token, OAuth client secret, CRON_SECRET, API keys).
