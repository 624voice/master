# PRD 2 — Web-Based Vapi Voice Demo

**Goal:** Let a prospect click a button on the 624 Voice site and have a live, spoken conversation with your Vapi AI agent — right in the browser, no phone call, no signup.

**Priority:** Build second. One third-party SDK, secrets handling, and cost controls.

---

## 1. What it is

A "🎙️ Talk to our AI agent" button that, when clicked, starts a **Vapi web call** using Vapi's browser SDK. The agent speaks and listens through the user's mic/speakers over WebRTC. The user can end the call anytime.

## 2. Vapi integration

- **SDK:** `@vapi-ai/web` (browser). Confirm current package name/version before installing.
- **Credentials needed from Chris:**
  - Vapi **public key** — safe to expose in the browser.
  - **Assistant ID** of the published demo agent.
- **How it connects:** the Web SDK is initialized with the public key, then `.start(assistantId)` opens the call. Vapi runs the call over WebRTC (Daily under the hood) — nothing to build for transport.
- **Secrets rule:** only the *public* key goes in the client. Your Vapi **private key must never** ship to the browser. If any flow needs the private key (e.g. minting short-lived tokens or creating call configs server-side), do it in a TanStack Start **server function** and return only what the client needs.

### Env vars
```
VITE_VAPI_PUBLIC_KEY=...     # exposed to client (VITE_ prefix), public key only
VITE_VAPI_ASSISTANT_ID=...   # public assistant id
VAPI_PRIVATE_KEY=...         # server only, if needed — NEVER prefixed VITE_
```
Set these in Netlify env settings, not committed.

## 3. UI / call states

A single component with clear states:

- **Idle:** brand-styled CTA button, one line of copy ("Have a live conversation with our AI receptionist").
- **Requesting mic:** handle the browser permission prompt; if denied, show a friendly fallback ("We need mic access to start the demo").
- **Connecting:** spinner / "Connecting…".
- **Live:** show a talking/listening indicator (animate on agent speech via SDK volume/speech events), a call timer, and a prominent **End call** button.
- **Ended:** thank-you state with an option to restart, and (optional) a CTA to book a real call / capture email.
- **Error:** graceful message + retry.

Wire the SDK event callbacks (call start, speech start/stop, volume, message/transcript, call end, error) to drive these states. Optionally render a live transcript.

Style with brand tokens (00-README): emerald CTA, `#18222f` call surface, Comfortaa headings.

## 4. Cost & abuse controls — **important**

Every web demo call costs you money (LLM + voice + telephony minutes). Build these in from day one:

- **Max call duration:** auto-end at N minutes (e.g. 3). Make it a config constant.
- **One active call at a time** per browser tab; disable the button while a call is live.
- **Optional gating:** a lightweight name/email (or just "click to start") before the first call. Recommended: capture email so demo traffic doubles as leads (feed into PRD 3's lead store). Config flag `REQUIRE_EMAIL_FOR_DEMO`.
- Consider a simple per-session/day cap to blunt abuse. Note for Chris: server-side rate limiting is possible but adds scope — decide if v1 needs it.

## 5. Technical notes

- Requires **HTTPS** and mic permissions — Netlify serves HTTPS, so production is fine; localhost is allowed by browsers for testing.
- Client-side component (browser-only) since it needs `navigator.mediaDevices` and the Web SDK. Guard against SSR: only initialize the SDK in the browser (e.g. in `useEffect`), never during server render.
- Browser support: modern Chrome/Safari/Firefox/Edge. Detect unsupported/no-mic and show fallback.
- Component location: `src/routes/demo.tsx` or a reusable `<VoiceDemo />` component embeddable on the landing page.
- Ask Chris before adding the dependency; pin the version.

## 6. Acceptance criteria

- [ ] Clicking the CTA requests mic access and starts a live Vapi web call with the configured assistant.
- [ ] User hears the agent and the agent responds to speech.
- [ ] UI reflects idle → connecting → live → ended, with a visible timer and End button.
- [ ] Mic-denied and unsupported-browser cases show friendly fallbacks, not crashes.
- [ ] Calls auto-end at the configured max duration.
- [ ] Only the public key is present in client bundle; private key (if used) stays server-side.
- [ ] Env vars are read from Netlify config, not hardcoded.
- [ ] Styling matches brand tokens; works on mobile.

## 7. Open questions for Chris

1. Which published Vapi assistant is the demo (assistant ID)?
2. Max call length and whether to gate behind email.
3. Do you want a live transcript shown, or audio only?
4. After the call ends, what's the CTA — book a meeting, capture email, or nothing?
