# Shared-core / tenant-config / adapter boundary

Audit-only (Phase C Gate 1D). No extraction or abstraction was performed.
The goal is to make the next customer a credentials + configuration +
integration-setup problem, not a clone of agent behavior.

| Concern | Core (reusable as-is) | Tenant config (varies per customer) | Provider adapter (Twilio/Google-specific) | Current hardcoding/debt (blocks customer #2 today) |
|---|---|---|---|---|
| Booking URL / provider | Booking-link handoff, `bookingMode: "link"` fail-closed, follow-up campaign keyed on `bookingLinkSentAt`, BOOKED only from appointment lifecycle | `AgentProfile.bookingCalendarLink`, `bookingProvider`, `bookingDetectionMode`, `bookingFollowUpOffsetsMinutes` | Google Calendar appointment schedule URL; Calendar API poll in `googleCalendar.ts` / `syncCalendar.ts` | Default URL still falls back through `SPEED2LEAD_BOOKING_URL` / `config/features.ts` 624Voice link. Conversation code is supposed to read the profile, but env/site defaults are tenant-1 values. No per-tenant booking-provider registry. |
| Business identity / agent persona | Turn engine, discovery guards, booking-link evaluators, session/stage machine | `AgentProfile` sender names, company, positioning, capabilities, non-capabilities, pain outcomes, signature | None | `DEFAULT_624VOICE_PROFILE` is a compile-time singleton (`getActiveProfile()`). Copy, Chris Hutson, 624Voice, and 25-minute consult are hardcoded there. No tenantId lookup by inbound number. |
| Escalation recipients | `sendHumanAlert` NX dedupe + `persistHumanFollowUp` | `humanEscalationConfig.phone` (today from `SPEED2LEAD_HUMAN_ESCALATION_PHONE`) | Twilio From/To for the operator SMS | Single env phone. No email/Slack adapter. Alert copy embeds "S2L" and assumes one on-call human. |
| Follow-up offsets / timing | Pain-prompt, no-response, booking-link, abandoned-demo, reminder schedule math | `painPromptDelayMinutes`, `noResponseDelaysMinutes`, `bookingFollowUpOffsetsMinutes`; reminder lead-time rules | Cron transport (Netlify scheduled functions / HTTP cron) | Abandoned-demo delays (15m / 1d / 3d / 10d) are constants in `abandonedRecovery.ts`, not profile. Legacy nurture/demo follow-up offsets live in those modules. Cron schedules in `netlify.toml` are site-global. |
| Flow-specific copy (ROI / Contact / Demo) | Stage ownership, which campaign runs, handoff into booking-link | Opener/pain/no-response/decline/pricing strings in flow modules + profile pain labels | None | Most prospect-facing sentences are source constants (`painPrompt.ts`, `contactFlow/openers.ts`, `demoFlow/openers.ts`, `bookingLinkCopy.ts`), not profile fields. A second customer with different voice still requires copy edits. |
| Supported products / use cases | Intent classifiers, discovery caps, meeting-intent → link | `painOutcomes`, `capabilities`, `nonCapabilities`, `headlinePainKeys`, `resultsGuarantee` | None | Trade list and ROI model (`lib/roi`) are HVAC/home-services shaped. Demo "Jessica" name and `/demo` resume URL are 624Voice product facts. |
| Calendar / provider settings | Lifecycle state machine, identity vs attribution split, confirmation/reminder/cancel SMS eligibility | Timezone, calendar id, OAuth client, consult length, booking page | Google OAuth + Calendar API + Meet conference helpers | Calendar `info@624voice.com`, America/Chicago, consult length, and OAuth client are env/site defaults. `patchCalendarEventDescription` assumes our attribution-block format. |
| Source attribution | `LeadIndexEntry.source` vs `bookingAttributionSource`, matching window math | `bookingAttributionWindowDays` | Calendar event description / attendee fields from Google | Attribution block text and matching heuristics assume one brand and one calendar. No multi-tenant lead index prefix (`appointment:lead:phone:` is global). |
| SMS transport / numbers | `sendSms` / send-state machine / opt-out ingress | From number, messaging service, test-phone allowlist | Twilio SDK `messages.create`, signature validation, Advanced Opt-Out `OptOutType` | `TWILIO_FROM_NUMBER` is process-global. Webhook URL allowlist special-cases `624voice.com` / `www.624voice.com`. Test allowlist is env. |
| Session / Redis keys | Agent session, lifecycle records, send-state, booking idempotency | `tenantId` on `AgentSession` (not actually used in Redis keys) | Upstash Redis REST | Keys are `speed2lead:*` / `appointment:*` with no tenant prefix. Two customers on one Redis would collide. |
| Compliance / opt-out | Ingress STOP/START/HELP, global opt-out flag, Twilio-classified vs app fallback | Keyword extras, confirmation copy | Twilio Advanced Opt-Out carrier messages (provider-automatic — do not wrap) | Confirmation copy is 624Voice-toned. No per-tenant compliance footer. |
| Voice demo intake | Vapi end-of-call parse → demo opener | Vapi assistant id, demo URL, form fields | Vapi webhook + structured outputs | Assistant/"Jessica", `/demo`, and metadata field names are 624Voice-specific. |

## What customer #2 should eventually require

1. Credentials: Twilio subaccount/number, Google Calendar OAuth, Vapi assistant, Upstash (or namespaced Redis prefix), OpenAI.
2. Configuration: an `AgentProfile` (or equivalent) plus booking URL, timezone, escalation phone, follow-up offsets, copy keys.
3. Integration setup: inbound webhook to this app, calendar sharing/polling, opt-out on the number.

Not required if the boundary is honored: forking `llmTurn`, booking-link handoff, lifecycle, or send-state.

## Debt that still forces a clone today

- Redis and Twilio are process-global, not tenant-scoped.
- Profile is a singleton imported everywhere.
- Substantial prospect copy lives beside engine code.
- Webhook host allowlist and default booking URL name 624Voice.
- Abandoned-demo and some demo strings name Jessica / 624Voice directly.
