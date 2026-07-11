# PRD 3 — Automated Lead Generation + Email/SMS Outreach

**Goal:** Collect leads (local + national home-services companies) and run automated email + text outreach at scale.

**Priority:** Build last, in phases. This is a **system, not a website feature** — and the "large-scale automated cold text/email" part carries real legal and deliverability risk. Read §1 before writing any code.

---

## 1. Read this first — scope and risk

Two honest cautions so you build the right thing:

**This is mostly NOT your TanStack site.** Your website's job here is small: a lead-capture form and an ingest endpoint. The sourcing, storage, enrichment, and outreach engine are a **separate backend/service** (worker + database + sending platforms). Trying to run mass outreach from the web app is the wrong architecture. The PRD splits the two.

**Cold SMS and cold email at scale are legally regulated. Don't build a raw mass-texting blaster.**
- **SMS / TCPA:** Texting people who haven't consented can carry statutory damages of **$500–$1,500 per message**. US carriers also require **A2P 10DLC registration** (via Twilio or similar) before business texting works at all, and cold/unconsented campaigns get blocked or fined. Treat SMS as **opt-in only** — people who gave you their number and agreed to texts.
- **Email / CAN-SPAM:** Legal but strict — every message needs a working unsubscribe, a physical mailing address, no deceptive headers, and honored opt-outs. Cold B2B email also needs a **separate sending domain** with SPF/DKIM/DMARC and gradual warmup, or you'll land in spam.
- **Use established rails, not homegrown senders.** A cold-email platform with built-in warmup and deliverability tooling for email; Twilio (10DLC-registered) for opted-in SMS. This keeps you compliant and out of spam far better than raw SMTP/API blasting.

> Recommendation: get a quick legal/compliance review of your outreach plan before Phase 3. Build Phases 1–2 now; gate Phase 3 on that review. This spec is engineering guidance, not legal advice.

You already have data/enrichment connectors available in this workspace (Apollo, ZoomInfo) — those are legitimate sourcing options for the national side and worth using instead of scraping.

## 2. Architecture overview

```
[624 Voice site]  ──lead form──▶  [Ingest API / server fn]  ──▶  [Leads DB]
                                                                      │
   [Sourcing jobs] ──local (Google Places), national (Apollo/ZoomInfo)┤
                                                                      ▼
                                                            [Enrichment + dedupe]
                                                                      │
                                                                      ▼
                                          [Outreach engine]  email → cold-email platform (warmup, unsub)
                                                             SMS   → Twilio A2P 10DLC (opt-in only)
                                                                      │
                                                                      ▼
                                                     [Replies / status → CRM + suppression list]
```

## 3. Phase 1 — Lead capture (on the website)

The only part that lives in the TanStack app now.

- **Lead form** component: name, company, email, phone (optional), # trucks / service type. Reuse it for the ROI-PDF gate (PRD 1) and voice-demo gate (PRD 2).
- **Consent capture:** explicit, unbundled checkboxes — one for email, a *separate* one for SMS ("I agree to receive text messages…"), with timestamp + the exact consent language stored. This is what makes later SMS legal.
- **Ingest endpoint:** TanStack Start server function `POST /api/leads` → validates, dedupes on email, writes to the leads store. Add basic spam protection (honeypot / rate limit / captcha).
- **Storage:** a real database (e.g. Postgres via Neon/Supabase, or Netlify's DB option). Schema below. Don't store leads in a flat file.

```
leads(
  id, created_at, source,           -- 'roi_pdf' | 'voice_demo' | 'contact_form' | 'sourced'
  name, company, email, phone,
  service_type, truck_count,
  email_consent bool, sms_consent bool, consent_text, consent_at,
  status,                           -- new | enriched | contacted | replied | unsubscribed
  unsubscribed_at
)
```

**Phase 1 acceptance:** form submits to server fn, validates + dedupes, stores lead with consent flags; suppression/unsubscribe respected from day one.

## 4. Phase 2 — Sourcing + enrichment (separate service)

- **Local home-services companies:** Google Places / Maps API by geography + category (HVAC, plumbing, roofing, etc.) → business name, phone, website. Note: Places gives business contact info, not personal emails.
- **National:** use Apollo / ZoomInfo (already connected here) to pull companies + decision-maker contacts matching your ICP.
- **Enrichment + dedupe:** normalize, dedupe against existing leads, enrich missing fields, tag `source='sourced'`.
- Run as scheduled jobs/workers, **not** in the request path of the website.

**Phase 2 acceptance:** a job pulls N companies for a given market/ICP, enriches, dedupes, and lands them in the leads DB with source tagging.

## 5. Phase 3 — Outreach engine (gated on compliance review)

- **Email:** integrate a cold-email platform (with warmup + deliverability). Dedicated sending domain, SPF/DKIM/DMARC configured. Sequences with delays, reply detection, auto-stop on reply, one-click unsubscribe wired to the suppression list.
- **SMS (opt-in only):** Twilio with **A2P 10DLC** brand + campaign registered. Only message leads with `sms_consent = true`. Every message identifies the sender and honors STOP/opt-out automatically.
- **Suppression list is law, not a feature:** any unsubscribe / STOP / bounce / complaint permanently suppresses that contact across all channels. Check it before every send.
- **Throttling & warmup:** ramp volume gradually; cap daily sends per domain/number. Blasting your whole list day one destroys deliverability and invites complaints.
- **Tracking:** delivery, open/reply (email), opt-out, and status back onto the lead record.

**Phase 3 acceptance:** a sequence sends to eligible (consented, non-suppressed) leads via the chosen platforms, respects throttles, auto-stops on reply/opt-out, and logs status — with unsubscribe/STOP handling verified end to end before any real volume.

## 6. What Cursor should build now vs. later

- **Now (in the TanStack repo):** Phase 1 — the lead form, consent capture, `/api/leads` ingest server function, DB schema/migrations, and unsubscribe handling.
- **Later (separate service, after decisions in §7):** Phases 2–3. Scaffold them as their own project/workers, not inside the marketing site.

## 7. Open questions / decisions for Chris

1. **Legal:** Are you doing cold outreach, or only contacting inbound/opted-in leads? This determines what's even buildable for SMS.
2. **Email platform** of choice (warmup-capable) and the **dedicated sending domain**.
3. **SMS:** committing to Twilio + A2P 10DLC registration? (Weeks of lead time — start early.)
4. **Database** choice (Neon/Supabase/Netlify DB).
5. **Sourcing:** confirm Apollo/ZoomInfo for national + Google Places for local, and your ICP definition (geographies, service types, company size).
6. **CRM:** where do replied/qualified leads go — a CRM, or just the leads DB for now?
