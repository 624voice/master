# 624Voice Speed-to-Lead — Claude Handoff Start Here

## Project

**624Voice Speed-to-Lead SMS Agent** — an autonomous SMS conversation agent that converts ROI-report leads into booked 25-minute consultations.

## Primary Purpose

Convert ROI report download → first meeting booked.

## Core Flow

```
ROI report delivered
→ short natural discovery (1–2 questions max)
→ pain / consequence reflection
→ outcome bridge (25-minute conditional ask)
→ meeting interest confirmed
→ real Google Calendar scheduling (code-owned)
→ booking + Google Meet
→ confirmation SMS
→ 24h + 2h reminders
```

## Primary KPI

ROI report download → first meeting booked.

## Non-Goal

This agent is **not** meant to fully qualify a prospect over SMS. Discovery exists only to establish relevance before the meeting bridge.

---

## Current Status: **NOT READY** for handset validation

The scheduling-state architecture rewrite is implemented, tested locally, and deployed to preview-61. **The deployed Twilio webhook boundary has not yet been proven** for the required A–H scheduling sequence.

---

## Latest Verified State (2026-08-26)

| Item | Value |
|------|-------|
| Latest commit | `7af6fb1bd82c6f1195c748a562227f0293346bb3` |
| Integration branch | `cursor/llm-orchestrator-537c` (PR #61 → preview-61) |
| Architecture branch | `cursor/scheduling-state-architecture-537c` (PR #80, merged into orchestrator) |
| Local tests | **657 pass**, 1 skip, 0 fail |
| CI | 4/4 green on `7af6fb1` |
| Preview URL | `https://deploy-preview-61--624voice.netlify.app` |
| Preview health SHA | `7af6fb1bd82c6f1195c748a562227f0293346bb3` |
| Preview LLM | `speed2LeadLlmEnabled: true` (allowlist-gated) |

---

## The Blocker

Direct unsigned HTTP POSTs to `/api/sms/inbound` return **403 Invalid Twilio signature** on preview (Netlify `NODE_ENV=production`).

Therefore:
- Unit tests, integration tests, orchestrator tests, and live evals **do not substitute** for deployed-boundary proof.
- Next validation must use **Twilio-signed preview requests** OR **real handset SMS** on allowlisted test numbers.

Known handset test numbers (allowlisted via `SPEED2LEAD_TEST_PHONES` on preview):
- `+1XXXXXXXXXX` (allowlisted test handset — see `SPEED2LEAD_TEST_PHONES` on preview)
- `+1YYYYYYYYYY` (second allowlisted test handset)

Sessions for these numbers were cleared before this handoff. Do not expose secrets.

---

## Major Lesson From Recent Iterations

> **Unit tests / local orchestrator tests / live evals are not enough by themselves.**

The deployed Twilio webhook boundary must be validated before calling the system READY.

Historical failures proved:
- Preview was serving an **older SHA** while fixes existed only on unmerged branches.
- Calendar truth was correct; **stale scheduling state** caused false NO_AVAILABILITY.
- Generic calendar-link fallback was sent too early.
- Meet URLs were stripped by a single URL policy that treated booked Meet links like fallback links.

---

## Document Map

| File | Contents |
|------|----------|
| `01-BUSINESS-AND-PRODUCT-CONTEXT.md` | Business, product, discovery rules |
| `02-CURRENT-ARCHITECTURE.md` | Runtime path, owner map |
| `03-CONVERSATION-AND-PROMPT.md` | Prompt assembly, LLM vs code |
| `04-SCHEDULING-ARCHITECTURE.md` | **Most important technical doc** |
| `05-CALENDAR-OAUTH-BOOKING.md` | Google OAuth, provider, booking URLs |
| `06-REMINDERS-AND-LIFECYCLE.md` | Reminders, lifecycle, cron |
| `07-SESSION-STATE-AND-PERSISTENCE.md` | Redis keys, session model |
| `08-BUG-HISTORY-AND-ROOT-CAUSES.md` | Chronological bug table |
| `09-ATTEMPTED-FIXES-AND-LESSONS.md` | What failed and why |
| `10-CURRENT-STATUS-AND-BLOCKERS.md` | Exact current state |
| `11-TARGET-END-STATE.md` | Ideal behavior |
| `12-VALIDATION-PLAN.md` | Test layers + A–H sequence |
| `13-FILE-MAP.md` | File reference |
| `14-CLAUDE-OPERATING-INSTRUCTIONS.md` | What Claude should do first |
| `CLAUDE-MASTER-CONTEXT.md` | Single pasteable summary |
| `CURRENT_SYSTEM_PROMPT.txt` | Sample assembled orchestrator prompt |

---

## Design Principle

**ONE BEHAVIOR = ONE OWNER**

- **Prompt** → judgment + natural language
- **Code** → state + truth + actions + invariants

---

## What NOT to Change Without Explicit Approval

- OAuth credentials / Google OAuth flow
- Google Meet creation logic
- Reminder timing windows (recently fixed to precise T−24h / T−2h)
- Production Twilio webhook signature validation
- Merging to `master`
- Transcript-specific behavioral patches

Read `14-CLAUDE-OPERATING-INSTRUCTIONS.md` before writing code.
