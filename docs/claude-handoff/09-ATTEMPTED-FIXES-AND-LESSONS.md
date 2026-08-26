# Attempted Fixes and Lessons

**Critical section.** These approaches failed. Claude must not repeat them.

---

## 1. Phrase-Level / Transcript-Specific Fixes

**What we tried:** Adding regex or special cases for specific handset transcript phrases (e.g., one exact "All of it" path, one "What about 5?" handler in isolation).

**Why it failed:** Each new phrase created another owner. Fixes worked for one transcript but broke adjacent turns. Test matrix grew unbounded.

**Lesson:** Never solve transcript failures with transcript-specific rules. Fix the state model or owner map.

---

## 2. Relying Only on Prompt Guidance

**What we tried:** Adding scheduling rules, discovery limits, and "don't send calendar links" instructions to the orchestrator prompt.

**Why it failed:** LLM ignored or inconsistently applied guidance. Prompt grew ~7.5% then was reduced. Scheduling rules in prompt conflicted with code-owned scheduling SMS.

**Lesson:** PROMPT = judgment + language. CODE = state + truth + actions. Do not re-add scheduling rules to prompt.

---

## 3. Multiple Modules Parsing Scheduling Constraints

**What we tried:** `intentParser.ts` parsed constraints, then `detectSchedulingConstraints()` in `schedulingContext.ts` re-parsed, then `service.ts` re-applied with `??` preserve semantics.

**Why it failed:** Second pass re-introduced stale values. Impossible bound combinations persisted (lo:960 > hi:720). Friday morning slots filtered despite Google truth.

**Lesson:** ONE parsing owner (`parseSchedulingStateUpdate`). ONE apply owner (`applySchedulingStateUpdate`). No second pass.

---

## 4. Preserving Stale State by Default

**What we tried:** Using `prior.field ?? newValue` or implicit preserve when field undefined.

**Why it failed:** New semantic intent (date change, daypart change, broadening) did not clear incompatible prior constraints. State accumulated until filters eliminated all slots.

**Lesson:** Explicit PRESERVE / REPLACE / CLEAR per field. Date change clears time constraints. Daypart change clears exact/anchor. Broadening clears narrow bounds.

---

## 5. Assuming Live Eval Success = Deployed Handset Success

**What we tried:** Running `eval/liveEval.test.ts` (56/58 pass) and declaring scheduling ready.

**Why it failed:** Live eval calls `orchestrateInboundTurn()` directly — never `handleInboundSms()`, Twilio signature validation, or Netlify runtime. Model behavior differed from deployed boundary.

**Lesson:** Four validation layers: unit → integration → live eval → **deployed boundary** → handset. Only last two prove production path.

---

## 6. Testing Direct Orchestrator Path Instead of Real Webhook

**What we tried:** HTTP replay to `/api/sms/inbound` without Twilio signature on preview.

**Why it failed:** Preview runs `NODE_ENV=production` → `isValidTwilioWebhook()` requires valid signature → 403.

**Lesson:** Use Twilio-signed requests, existing signed test harness (if built), or real handset SMS. Do not disable signature validation.

---

## 7. Single URL Policy for Multiple Semantic URL Types

**What we tried:** One `calendarLinkAllowed` boolean controlled both generic fallback links and persisted booked Meet URLs.

**Why it failed:** Booking confirmation included Meet URL → policy stripped it because fallback links were disallowed.

**Lesson:** Typed URL classification: `BOOKED_MEETING_LINK`, `BOOKING_FALLBACK_LINK`, `UNAUTHORIZED_URL`. Meet URLs always preserved.

---

## 8. Treating "Yes/Sure" as Strong Interest Without Context

**What we tried:** Any affirmative reply triggered meeting interest and scheduling entry.

**Why it failed:** "Sure" answering a diagnostic question (not bridge) jumped to scheduling. "Yes" after negation context misfired.

**Lesson:** Check conversation stage, prior question type, and negation context before confirming meeting interest.

---

## 9. Assuming PR Changes Were Already in Preview

**What we tried:** Handset testing on preview-61 assuming latest fix branch was deployed.

**Why it failed:** Preview served older SHA. Fixes existed on unmerged branches (e.g., PR #79 not yet in preview-61).

**Lesson:** Always verify `GET /api/health` → `gitCommitSha` matches expected commit before handset testing.

---

## 10. Broad NO_AVAILABILITY Copy for Internal State Failures

**What we tried:** Returning "nothing available" when internal state was corrupted (impossible bounds) rather than distinguishing provider truth from application logic failure.

**Why it failed:** Misled operators into thinking calendar was full when state was broken. Masked architecture bugs.

**Lesson:** Distinguish `REAL_NO_AVAILABILITY` (provider returned empty) from `INVALID_INTERNAL_CONSTRAINT` (state corruption). Set `applicationLogicFailure` flag to block fallback links.

---

## 11. Adding Scheduling Rules Back After Architecture Cleanup

**What we tried:** Incremental prompt additions after each handset failure instead of auditing architecture.

**Why it failed:** Prompt bloat returned. Duplicated code-owned behavior. Model still couldn't reliably own scheduling.

**Lesson:** After 2–3 fixes in same subsystem, stop and audit architecture. Pre-change contradiction audit → implement → post-change bloat audit.

---

## 12. Using Generic Calendar Link as Scheduling Engine

**What we tried:** Falling back to `calendar.app.google/...` when provider query was slow or state was confused.

**Why it failed:** Sent fallback immediately after report reaction ("All of it", "Missed calls"). Unacceptable customer experience.

**Lesson:** Google API is truth. Fallback link only after explicit request or legitimate multi-attempt failure. Never on opening replies.

---

## 13. mergeIntentIntoState Clearing Anchor on Daypart Set

**What we tried:** Early state merge logic that cleared anchor when daypart was set unconditionally.

**Why it failed:** Broke anchor-based ranking for "around 3 in the afternoon" scenarios.

**Lesson:** Only clear fields when semantic change requires it (explicit CLEAR in update model).

---

## 14. Gate Clearing Offered Slots Before Selection Check

**What we tried:** `prepareInboundSchedulingTurn` cleared offered slots before parser could match selection.

**Why it failed:** "10am" when 10am was offered didn't book because offers were cleared first.

**Lesson:** Early return in parser for offered-slot selection — selection is not a constraint change.

---

## What Worked

| Fix | Approach | Commit / PR |
|-----|----------|-------------|
| OAuth migration for Meet | Infrastructure change, smoke tests | `976a0da` |
| Typed URL policy | Semantic distinction in outboundPolicy | `4398e7b` |
| Precise reminder windows | Pure function eligibility logic | `4332c2b` |
| Deploy version health | `/api/health` SHA verification | `599a53f` |
| State architecture rewrite | FieldUpdate PRESERVE/REPLACE/CLEAR | `7af6fb1` / PR #80 |
| Single scheduling apply path | Remove second pass in service | `7af6fb1` |
| Negation before extraction | NEGATED_TIME_RE in intentParser | `7af6fb1` |
| Evening = late afternoon in grid | Align rangeResolver + filterRank | `4398e7b` |
| Fallback link gating | allowCalendarLinkFallback conditions | Multiple commits |
| Guardrails for fake async | Pending-action language rejection | Multiple commits |

---

## Anti-Pattern Checklist

Before proposing a fix, ask:

1. Does this add a second owner for behavior already owned elsewhere?
2. Is this a transcript-specific patch?
3. Does this add scheduling rules to the prompt?
4. Does this preserve stale state by default?
5. Does this assume eval/orchestrator path equals deployed path?
6. Does this conflate provider failure with state corruption?
7. Has this subsystem already had 2–3 patch attempts?

If yes to any → audit architecture first.
