# 624 Voice — Build Specs for Cursor

This folder contains three feature specs (PRDs) written to be pasted into Cursor and built directly into your existing site. Read this file first — it sets the shared context (stack, brand, conventions) so you don't have to repeat it in every Cursor prompt.

## The three features

1. **ROI Calculator** (`01-roi-calculator-PRD.md`) — a trade-specific, three-scenario ROI widget with PDF export, built from the finished `624 ROI Calculators…xlsx` model (all math verified). Self-contained front end. **Build first.**
2. **Vapi Voice Demo** (`02-vapi-voice-demo-PRD.md`) — a "talk to our AI" button that runs a live web call with your Vapi agent. Integration work.
3. **Automated Lead Gen + Outreach** (`03-lead-gen-outreach-PRD.md`) — lead capture on-site plus a compliant email/SMS outreach pipeline. Largest scope, real legal exposure. Build last, in phases.

## Recommended build order

Do them in the order above. The ROI calculator proves out the pattern (a `src/routes` page + a server function + Tailwind styling) with almost no external dependencies. Vapi adds one third-party SDK and secrets handling. Lead gen is a multi-week system, not a single feature — don't start it until the first two ship.

## Your stack (constraints for Cursor)

- **Framework:** TanStack Start (React 19 full-stack), file-based routing under `src/routes/`
- **Build/runtime:** Vite 7, Bun (use `bun` / `bun install`, not npm)
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript (strict)
- **Deploy:** Netlify (`@netlify/vite-plugin-tanstack-start`)
- **Config:** business name/config in `site.json`; docs in `SITE.md`
- **Server-side work:** use TanStack Start **server functions** (`createServerFn`) or API routes — this is a real full-stack app, so backend logic (PDF generation, Vapi token minting, lead ingestion) belongs in server functions, not the browser.

Tell Cursor explicitly: *"This is a TanStack Start app using Bun and Tailwind 4. Add routes under `src/routes/`, put server-side logic in server functions, and match existing conventions in the repo. Do not introduce Next.js or npm."*

## Brand tokens (apply to all UI)

Put these in Tailwind theme / CSS variables and use them everywhere so the features match the site.

**Colors**
- `#94A3B8` — headers, icons, accents
- `#10b981` — primary background / CTA (emerald)
- `#FFFFFF` — backgrounds, body text (on dark)
- `#18222f` — sub-text, accents, dark surfaces

**Fonts**
- Headings: **Comfortaa** (medium)
- Body: **Afacad Flux** (normal)
- Emphasis/bold: **Plus Jakarta Sans** (bold)

## Before you start — accounts, keys, and decisions to line up

These are the things Cursor can't invent. Have them ready or the specs will stall on placeholders.

**ROI Calculator**
- Math is **final** — all assumptions come from `624 ROI Calculators Home Services final (1).xlsx` (five trades, three scenarios, five drivers, $1,500/mo price) and are embedded in the PRD as a ready-to-use config. No numbers to supply. Only small UX decisions remain (see the PRD's open questions).

**Vapi Voice Demo**
- A Vapi account with a published assistant.
- Your Vapi **public key** (browser-safe) and **assistant ID**.
- Decide on cost controls: max call length, and whether the demo is open or gated behind a name/email.

**Lead Gen + Outreach**
- Decide sending rails: an email platform (e.g. a cold-outreach tool with domain warmup) and, for SMS, Twilio with **A2P 10DLC registration**.
- A dedicated sending domain (not your primary) with SPF/DKIM/DMARC.
- Legal review of your outreach approach — cold SMS especially (TCPA). See the PRD's compliance section.
- Data source decisions for lead sourcing (Google Places for local, a B2B database for national).

## How to use each PRD with Cursor

Open the repo in Cursor, then paste one PRD at a time into the chat/composer with a lead-in like: *"Implement the following spec in this codebase, following the conventions in 00-README. Ask me before adding any new dependency."* Build and review one feature before moving to the next.
