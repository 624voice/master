# Conversation Behavior and Prompt Architecture

## Desired Conversational Behavior

### Message Shape

- **One question per outbound message** (enforced by guardrails)
- Natural, concise SMS — no markdown, no bullet lists
- No robotic qualification theater
- No generic AI pitch — lead with business outcomes, not technology
- No fake async: never "I'll confirm later", "I'm holding it", "I'll send the link later"
- Direct customer questions must be answered **first** before continuing discovery or scheduling
- Scheduling state must persist underneath FAQ answers

### Discovery

| Rule | Implementation |
|------|----------------|
| Normal depth | 1–2 diagnostic questions |
| Hard max | 2 (`discoveryProgress.ts`) |
| Rich single answer | Bridge after one if 624Voice relevance is clear |
| Explicit meeting intent | Skip remaining discovery |
| After meeting interest confirmed | No more discovery questions (guardrail) |
| Known facts | Do not re-ask report data unless corrected |

Discovery phases: `awaiting_report_reaction` → `diagnostic` → `discovery_complete` → `bridge` → `scheduling` → `booked`

### Bridge

Conceptual structure (not a hardcoded script):

```
pain → business consequence → desired outcome → lower effort / no extra headcount → 25-minute conditional ask
```

Injected via `outcomeBridgeContextForPrompt()` in `businessContext.ts`. Bridge and scheduling ask must **not** appear in the same message (`violatesBridgeSchedulingSeparation` in `outboundPolicy.ts`).

### Scheduling Conversation

Once meeting interest is confirmed, **code owns all scheduling SMS**:
- Availability offers
- Exact-time checks
- Booking confirmations
- Failure copy

The LLM is told: **"No calendar times, bookings, or links."**

### Pricing

High-level only:
- "Pricing depends on scope; exact pricing is not quoted over SMS."
- Guardrail rejects exact dollar amounts unless allowed ROI token

### Name Usage

- Opening: use first name
- Final booking confirmation: use first name
- Avoid overusing name mid-conversation (`containsDisallowedProspectName`)

---

## Successful Bridge Behavior (Handset Testing)

Observed good patterns:
- Acknowledged report pain (e.g., missed calls) without re-asking report question
- Reflected consequence naturally ("calls going to voicemail while crews are out")
- Connected to outcome (respond faster, book more jobs, without adding headcount)
- Single conditional 25-minute ask without day/time question in same turn
- Transition to scheduling felt natural after "yes" / "sure" with context check

---

## Prior Bad Behaviors (Fixed or Guardrailed)

| Bad behavior | Symptom | Owner fix |
|--------------|---------|-----------|
| Too many discovery questions | 3+ diagnostic turns | `discoveryProgress.ts` hard max + guardrail |
| Stage regression | Back to discovery after scheduling | `conversationStage.ts`, `conversationHandoff.ts` |
| Repeated report question | "What stood out?" again | `doNotReask` in knownFacts + guardrails |
| Fake availability | Times not from Google | Authoritative scheduling reply |
| Stale slot reuse | Old offers after date change | `invalidateOffers` in state update |
| Generic calendar-link fallback | Link after "All of it" / "Missed calls" | `allowCalendarLinkFallback()` gates |
| Missed direct questions | FAQ ignored during scheduling | `answer_customer_question` task + gate |
| Vague "holding it" | No booked slot claimed | Guardrail rejects pending-action language |
| Fake future promises | "I'll send link later" | Guardrail + no LLM scheduling ownership |
| Meet URL stripped | Link removed after "Here's the Google Meet link:" | Typed URL policy (`BOOKED_MEETING_LINK`) |

---

## Prompt Architecture

### Source Files

| File | Role |
|------|------|
| `src/server/speed2Lead/prompts.ts` | `buildOrchestratorInstructions()` — main system prompt |
| `src/server/speed2Lead/businessContext.ts` | Sales objective, capabilities, bridge context, allowed facts |
| `src/server/speed2Lead/conversationStage.ts` | `resolveLlmTurnTask()` — task/stage selection |
| `src/server/speed2Lead/discoveryProgress.ts` | `knownFactsBlock()` inputs |
| Repair builders in `prompts.ts` | One-question, bridge, terminology, unsupported-claim repairs |

**No external `.md` prompt files.** OpenAI Responses API uses the `instructions` field assembled at runtime.

### Assembly Flow

```
buildOrchestratorInstructions(context, now, inboundMessage)
  → resolveLlmTurnTask(context, inboundMessage)     // stage + task
  → businessContextForPrompt()                       // static product facts
  → outcomeBridgeContextForPrompt({ primaryPain })   // pain-specific bridge
  → allowedFactsForPrompt()                          // guardrail-aligned facts
  → knownFactsBlock(context.knownFacts)              // session memory
  → currentCentralContext(now)                       // America/Chicago clock
  → flowContextBlock(context)                        // roi | contact | demo
  → JSON payload embedded in instructions string
```

### Final Assembled Shape

```
You are Chris with 624Voice replying over SMS.
Follow the JSON context for this turn only.
Return only the SMS body. No markdown. No calendar times, bookings, or links.

{ JSON payload }
```

See `CURRENT_SYSTEM_PROMPT.txt` for a representative scheduling-stage sample (~3,750 characters / ~900 tokens).

### LLM Turn Tasks (`LlmTurnTask`)

| Task | When |
|------|------|
| `acknowledge_report_reaction_and_ask_one_operational_question` | First reply after report |
| `ask_one_operational_followup` | Second diagnostic if needed |
| `ask_conditional_meeting_bridge` | Discovery complete, bridge turn |
| `answer_customer_question` | Direct FAQ during any stage |
| `brief_active_conversation` | Scheduling stage — LLM only for brief non-scheduling replies |

### businessContext Inputs

From `businessContext.ts`:
- `SALES_OBJECTIVE` — problem → capability → 25-min demo → schedule
- `CORE_CAPABILITIES` — what 624Voice does
- `POSITIONING` — prevent opportunities falling through cracks
- `NOT_CAPABILITIES` — analytics/dashboard/reporting-only claims
- Pain → outcome maps for bridge (`outcomeBridgeContextForPrompt`)

### Scheduling-Related Prompt Guidance

**Intentionally minimal.** Scheduling rules were removed from prompt because code owns:
- Date/time parsing
- Slot offers
- Booking confirmation
- Calendar links

During `stage: "scheduling"`, task guidance is simply: "Reply briefly. Do not ask scheduling questions or offer times."

### Guardrail Guidance (Code, Not Prompt)

Outbound validation in `guardrails.ts` — not duplicated in prompt:
- Max 320 chars
- Max 1 genuine question
- No markdown, exact pricing, guarantees
- No booking claims without `toolState.bookingConfirmed`
- No implied availability without tool results
- No unauthorized calendar URLs
- No discovery after meeting interest
- No bridge + scheduling ask in same message

---

## Prompt History

1. **Early state:** Prompt contained duplicated memory, terminology, and scheduling guidance alongside code logic.
2. **Cleanup pass:** ~7.5% reduction by removing redundant scheduling rules and memory duplication.
3. **Architecture passes (post-OAuth):** Deliberately avoided re-adding scheduling rules to prompt.
4. **Current principle:** PROMPT = judgment + language; CODE = state + truth + actions + invariants.

---

## Code-Owned Rules (NOT in Prompt)

These are deterministic and must not be re-added to prompt:

| Behavior | Owner |
|----------|-------|
| Conversation stage transitions | `conversationStage.ts` |
| Discovery count / phase | `discoveryProgress.ts` |
| Meeting interest flag | `meetingInterest.ts`, `conversationHandoff.ts` |
| Scheduling entry legality | `schedulingGate.ts`, `conversationHandoff.ts` |
| All scheduling state mutations | `intentParser.ts`, `stateUpdate.ts` |
| Provider queries and slot filtering | `service.ts`, `filterRank.ts`, `provider.ts` |
| Booking and Meet URL | `bookConsultation.ts`, `googleCalendar.ts` |
| Authoritative scheduling SMS | `service.ts` → `buildReplyFromSchedulingResult()` |
| Fallback link eligibility | `allowCalendarLinkFallback()` |
| URL classification | `outboundPolicy.ts` |
| Reminder timing | `reminderSchedule.ts` |

---

## Remaining Prompt Duplication / Bloat Flags

Low risk but worth monitoring:
- `allowedFacts` and `businessContext.notCapabilities` overlap (intentional redundancy for guardrail alignment)
- `knownFacts.doNotReask` is partially redundant with code stage checks
- Repair instructions repeat core constraints — acceptable for retry loops

**Do not expand prompt to fix scheduling bugs.** That path failed repeatedly (see `09-ATTEMPTED-FIXES-AND-LESSONS.md`).
