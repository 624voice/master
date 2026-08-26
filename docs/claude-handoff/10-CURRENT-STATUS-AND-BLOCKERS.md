# Current Status and Blockers

Verified against repo on 2026-08-26.

---

## Git State

| Item | Value |
|------|-------|
| Current branch | `cursor/llm-orchestrator-537c` |
| Latest commit | `7af6fb1bd82c6f1195c748a562227f0293346bb3` |
| Commit message | "Implement canonical scheduling state architecture with explicit update semantics." |
| Architecture branch | `cursor/scheduling-state-architecture-537c` (merged into orchestrator via PR #80) |
| Integration PR | PR #61 → preview-61 |
| Base branch | `master` (not merged) |

Recent commit history:
```
7af6fb1 Implement canonical scheduling state architecture with explicit update semantics.
2b1c9e1 Bake git SHA into health diagnostic at build time
599a53f Add deploy version health diagnostic and deployed-boundary smoke tests
4398e7b Fix evening scheduling, Meet URL stripping, and premature scheduling entry
4782566 Harden conversion flow and scheduling truth with consolidated constraints
4332c2b Use one-sided reminder windows so SMS never sends early
976a0da Migrate Google Calendar auth to OAuth for Meet-capable booking
```

---

## Test State

| Metric | Value |
|--------|-------|
| Local tests | **657 pass**, 1 skip, 0 fail |
| Test files | 62 |
| Test runner | Bun (`bun:test`) |
| CI | 4/4 green on `7af6fb1` |
| Skipped | Live eval (`S2L_LIVE_EVAL=true` required) |

---

## Deployment State

| Item | Value |
|------|-------|
| Platform | Netlify |
| Preview URL | `https://deploy-preview-61--624voice.netlify.app` |
| Preview branch | `cursor/llm-orchestrator-537c` (PR #61) |
| Health endpoint | `GET /api/health` |
| Expected SHA | `7af6fb1bd82c6f1195c748a562227f0293346bb3` |
| Deploy context | `preview` |
| Twilio webhook | `https://deploy-preview-61--624voice.netlify.app/api/sms/inbound` |
| LLM on preview | `speed2LeadLlmEnabled: true` (allowlist-gated) |

**Verify before testing:** fetch `/api/health` and confirm `gitCommitSha` matches `7af6fb1`.

---

## Status: NOT READY

The scheduling-state architecture rewrite is implemented, unit-tested, and deployed to preview-61. **The system is NOT READY for handset validation sign-off** because the deployed Twilio webhook boundary has not been proven for the required A–H scheduling sequence.

---

## Exact Blocker

**Direct unsigned HTTP POSTs to `/api/sms/inbound` return HTTP 403** with "Invalid Twilio signature".

### Technical Detail

`src/server/sms/twilio.ts`:

```typescript
export function isValidTwilioWebhook(request, signature, params) {
  if (process.env.NODE_ENV !== "production") {
    return true;  // local dev only
  }
  return getWebhookValidationUrls(request).some((url) =>
    validateTwilioRequest(signature, url, params),
  );
}
```

Netlify preview runs with `NODE_ENV=production` → signature required.

Validation inputs:
- `X-Twilio-Signature` header
- Full webhook URL (request URL + `TWILIO_WEBHOOK_URL` env + www variants)
- POST body params (Twilio form fields)
- `TWILIO_AUTH_TOKEN` (server-side, not exposed)

### What This Blocks

- Direct HTTP replay of A–H sequence without signing
- Assuming integration tests that mock `handleInboundSms` prove deployed behavior
- Calling system READY without deployed-boundary evidence

### What Does NOT Block

- Real handset SMS from allowlisted test numbers (Twilio signs automatically)
- Local development (`NODE_ENV !== "production"`)
- Unit/integration tests that bypass webhook

---

## Twilio Signature Test Harness

**No dedicated repo tool** generates valid Twilio signatures for preview testing.

Options to run A–H:
1. **Real handset SMS** — simplest; Twilio signs outbound webhook automatically
2. **Programmatic signing** — use Twilio SDK `validateRequest` inverse: compute signature with auth token + URL + params (requires secure token access, not in repo)
3. **Local integration tests** — prove logic but NOT deployed boundary

**Do NOT disable signature validation on preview/production.**

---

## Validation Not Yet Completed

| Validation | Status |
|------------|--------|
| A–H deployed-boundary sequence | **Not run** through signed webhook |
| Handset scheduling after 7af6fb1 | **Pending** |
| 2h reminder on live booking | **Pending** (24h old booking already fired early pre-fix) |

---

## Test Session State

Known handset test numbers (allowlisted via `SPEED2LEAD_TEST_PHONES` on preview):
- `+12148438991`
- `+18178544399`

Sessions cleared via `scripts/reset-s2l-test-phone.ts` before this handoff.

Reset clears: session, opt-out, demo/nurture follow-ups, active lifecycle for phone.
Reset does NOT clear: OAuth connection, unrelated lifecycle records, reminder index entries for other events.

---

## Discrepancies vs User-Provided Context

| Item | User context | Repo truth | Notes |
|------|--------------|------------|-------|
| Commit | `7af6fb1` | `7af6fb1bd82c6f1195c748a562227f0293346bb3` | Match |
| Tests | 657 pass, 1 skip | 657 pass, 1 skip | Match |
| Branches | orchestrator + scheduling-state-architecture | Both exist; architecture merged into orchestrator | Match |
| Booking URL | `Jy8NRQgZrm5XFVRw9` | `SPEED2LEAD_BOOKING_URL` in features.ts | Match |
| Legacy URL | `U757QVWUJVK8x3a16` | Still in `docs/appointment-lifecycle-setup.md` only | Docs lag code |
| PDF URL | Not mentioned | `hpzTSkjb9NTqaMjh9` in `BOOK_MEETING_URL` | Third URL exists for PDF/external |

---

## Known Risks

| Risk | Severity | Detail |
|------|----------|--------|
| Deployed boundary unproven | **High** | Blocker Y — A–H not validated through webhook |
| Last-write-wins session race | Medium | Concurrent SMS to same phone |
| Live eval drift | Low | `sched-stress-friday-at-3` may expect old semantics |
| Legacy URL in setup docs | Low | `U757QVWUJVK8x3a16` in appointment-lifecycle-setup.md |
| Appointment schedule ↔ calendar relationship | Medium | Not fully proven programmatically |
| Preview vs production Twilio config | Medium | Webhook URL must match validation candidates |

---

## Recommended Immediate Next Step

**No code changes until deployed-boundary results are known.**

1. Verify preview SHA via `/api/health`
2. Run A–H sequence via real handset SMS on allowlisted test number
3. For each turn, inspect: canonical state, request key, provider query, raw slots, filtered slots, final SMS
4. Only after clean A–H → consider READY for broader handset validation

See `12-VALIDATION-PLAN.md` for full A–H sequence definition.
