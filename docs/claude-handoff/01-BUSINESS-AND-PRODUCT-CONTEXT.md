# Business and Product Context

## What 624Voice Sells

624Voice provides automation for home-service businesses:

- **Speed-to-Lead agents** — respond to inbound leads quickly via SMS/text
- **AI Voice Receptionist** — answer/respond when the business cannot
- **Websites** built for conversion + automation

Primary audience: home-service business owners, often **7–20 truck** operations.

## Buyer Priorities

Prospects care about:

- More booked jobs
- Less missed revenue
- Faster lead response
- Less manual follow-up
- Less front-office workload
- More capacity without proportional headcount
- Simplicity and ROI

The agent should **not lead with AI**. AI is implementation detail, not the primary benefit.

## Product Objective for This Agent

**Convert an ROI-report lead into a booked 25-minute consultation** with Chris at 624Voice.

Success = prospect agrees the problem matters → agrees to a short walkthrough → books a real calendar slot → receives Google Meet confirmation → receives reminders.

## Desired Bridge Structure

Conceptual pattern (not a hardcoded script):

```
pain / problem
→ business consequence
→ desired outcome
→ lower effort / no extra headcount
→ ask for 25 minutes
```

Example structure:

> "So right now [pain], which means [consequence]. If I could show you a way to [desired outcome] without [undesired effort/cost], would it be worth 25 minutes to take a look?"

Outcomes are pain-specific and injected via `outcomeBridgeContextForPrompt()` in `businessContext.ts`. Technology is secondary.

## Discovery Rules

| Rule | Detail |
|------|--------|
| Normal diagnostic depth | 1–2 questions |
| Hard max | 2 diagnostic questions |
| Rich single answer | Bridge after one if 624Voice relevance is clear |
| Explicit meeting intent | Skip remaining discovery |
| After meeting interest confirmed | **No more discovery** |
| Known facts | ROI report already contains substantial data — do not re-ask unless corrected |

Discovery phases (`DiscoveryPhase` in `sessionMemoryTypes.ts`):

`awaiting_report_reaction` → `diagnostic` → `discovery_complete` → `bridge` → `scheduling` → `booked`

## ROI Report Context

The ROI report includes business name, opportunity estimates, and primary pain signals. The agent should:

- Acknowledge what they flagged in the report
- Ask operational follow-ups only when relevance to 624Voice is still unclear
- Never repeat "what stood out in the report?" after it was answered

## Pricing Over SMS

High-level only:

- Pricing depends on scope/volume/setup
- No exact quote over SMS unless product config explicitly supports it
- Allowed fact in prompt: "Pricing depends on scope; exact pricing is not quoted over SMS."

## Name Usage

- Opening message: use first name
- Final booking confirmation: use first name
- Avoid overusing name mid-conversation

## Positioning Constraints (Guardrailed)

624Voice **is**:
- Helps prevent opportunities from falling through the cracks by responding and taking action

624Voice **is not** (unsupported claims):
- Missed-call analytics software
- A reporting dashboard that merely flags calls for humans
- A call-log reporting tool

These constraints appear in `businessContext.ts`, prompt `allowedFacts`, and outbound guardrails.

## Customer Experience Goal

The prospect should feel they are texting with a **competent human scheduler who understands their business**, not a chatbot doing qualification theater.

Bad patterns to avoid (documented in bug history):
- Too many discovery questions
- Stage regression after scheduling started
- Fake availability or async promises
- Generic calendar link before genuine scheduling failure
- Vague "I'm holding it" without a booked slot
- Ignoring direct customer questions during scheduling
