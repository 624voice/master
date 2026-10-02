# Phase 2 website polish — final owner handoff (PR #98)

**Branch:** `cursor/website-design-polish-e498`  
**Draft PR:** https://github.com/624voice/master/pull/98  
**Do not merge.** Production is unchanged.

---

## 1. Legacy public deploy removed

| Check | URL / path | Anonymous result |
|-------|------------|------------------|
| Legacy deploy `/` | `https://6abd56734482b0f2f00832ab--624voice-phase2-owner-qa.netlify.app/` | **404** (deploy deleted via Netlify API) |
| Legacy `/api/health` | same host | **404** |
| Legacy asset | same host `/assets/…` | **404** |

Deletion record: [`legacy-deploy-removal-evidence.json`](legacy-deploy-removal-evidence.json).

**Disclosed URL inventory (all must not expose private build anonymously):** [`preview-url-inventory.json`](preview-url-inventory.json) — `exposesPrivateBuildAnonymously: false` for every row (audit script: [`scripts/phase2/audit-disclosed-preview-urls.ts`](../../../scripts/phase2/audit-disclosed-preview-urls.ts)).

---

## 2. Final commit and SHA table

| Role | SHA |
|------|-----|
| Last **runtime-changing** commit (fail-closed edge gate + deploy-preview protect) | `c6b80aef650c01dd4520f771d3295ad5d792327a` |
| Deploy-script-only (re-link QA site after auth sync; no app/runtime change) | `0406a0b15f9ab773d99d61d01fa925d859de6f60` — see [`commit-0406a0b-analysis.md`](commit-0406a0b-analysis.md) |
| **Final PR #98 HEAD** | `d0f528cf25d5382a5e1182bb122a6a98c94e541e` |
| Owner-QA **deployed-source / runtime** SHA (authenticated `/api/health`) | `d0f528cf25d5382a5e1182bb122a6a98c94e541e` |
| PR #98 deploy-preview **runtime** SHA (authenticated `/api/health`) | `d0f528cf25d5382a5e1182bb122a6a98c94e541e` |
| Evidence-only commits after last runtime change | `18c080eaf00479a599d344a9a993d27e18818543`, `d0f528cf25d5382a5e1182bb122a6a98c94e541e` (artifacts, logs, inventory only — no application diff vs `18c080e…`) |

Both protected surfaces report the **same 40-character runtime SHA** at handoff time. Live proof: [`preview-auth-evidence.json`](preview-auth-evidence.json) (`good-creds-health` samples).

**Canonical owner-QA deploy:** `https://6abfcf19bbf579f331162ca5--624voice-phase2-owner-qa.netlify.app/`  
**PR #98 deploy preview:** `https://deploy-preview-98--624voice.netlify.app/`

---

## 3. Owner login (protected previews)

**Secure channel:** Netlify Team Dashboard — environment variables on site **`624voice-phase2-owner-qa`** (and deploy-preview context on main site **`624voice`** for PR preview). Credentials were provisioned during automated deploy; they are **not** in Git, PR comments, or this handoff.

**Variables:** `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER`, secret `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS`.

**URLs:** canonical owner-QA URL above and `deploy-preview-98--624voice.netlify.app`.

**Browser process:** open URL → HTTP Basic Auth prompt → enter user and password from Netlify → site loads with `noindex` headers.

Detail: [`OWNER_PREVIEW_ACCESS.md`](OWNER_PREVIEW_ACCESS.md).

---

## 4. Evidence index (final PR HEAD)

| Artifact | Path |
|----------|------|
| Screenshot index | [`SCREENSHOTS.md`](SCREENSHOTS.md) |
| Desktop / mobile / assessment states | [`screenshots/`](screenshots/) |
| Assessment **Results** (fixture, no lead/SMS) | [`screenshots/assessment-results-1280.png`](screenshots/assessment-results-1280.png), [`assessment-results-capture-method.json`](assessment-results-capture-method.json) |
| Guarantee inventory | [`guarantee-inventory.md`](guarantee-inventory.md), [`guarantee-inventory.raw.txt`](guarantee-inventory.raw.txt), [`guarantee-rendered-check.json`](guarantee-rendered-check.json) |
| Fleet five-band | [`fleet-band-evidence.md`](fleet-band-evidence.md) |
| Brand colors | [`brand-color-comparison.png`](brand-color-comparison.png), [`brand-color-comparison.html`](brand-color-comparison.html) |
| Auth / fail-closed | [`preview-auth-evidence.json`](preview-auth-evidence.json) |
| Full test log | [`bun-test-full.log`](bun-test-full.log) |
| Build log | [`bun-build.log`](bun-build.log) |
| Test failure baseline / analysis | [`test-failure-baseline.json`](test-failure-baseline.json), [`test-failure-analysis.md`](test-failure-analysis.md) |

ROI and 404 screenshots: `screenshots/desktop-1280-roi-calculator.png`, `desktop-1280-404.png`, `mobile-375-404.png` (protected deploy `6abfcf19…`, runtime SHA `d0f528c…`).

---

## 5. Tests and build (final commit)

- **Build:** success — [`bun-build.log`](bun-build.log)
- **Full suite:** **837 pass, 10 fail, 847 total** — [`bun-test-full.log`](bun-test-full.log)
- **Polish regression:** `scripts/phase2/website-polish-regression.test.ts` — 11/11 when run alone

Failures are documented with baseline comparison in [`test-failure-analysis.md`](test-failure-analysis.md). No production/frozen behavior was changed to green the suite.

---

## 6. Known issues (honest)

- Full `bun test` remains **10 failures** (environment, stale hard-coded Netlify URLs in browser journeys, suite-order pollution for SMS/analytics tests).
- Assessment Results screenshot uses **deterministic SSR fixture**, not live submission (by design for this preview).
- Duplicated `noindex` token in some responses is harmless (nonblocking).

---

## 7. Visual review checklist (short)

1. **Home** — hero, CTAs, brand green, nav/footer.
2. **What we do / How we work** — cards, journey diagram, copy.
3. **Demo / About / Contact / Book** — layout, forms, CTAs.
4. **Assessment** — BP1/BP2, fleet **50+** band, progress UI, lead gate (screenshots).
5. **Assessment Results** — fixture screenshot vs expected scoring layout.
6. **ROI calculator** — page polish, no live SMS.
7. **404** — branded not-found desktop + mobile.
8. **Guarantee** — confirm marketing pages show **no** guarantee while flag false.
9. **Mobile** — home, assessment, contact, book, 404.

---

Private implementation remains in progress. Awaiting owner visual review of the protected final website-polish preview.
