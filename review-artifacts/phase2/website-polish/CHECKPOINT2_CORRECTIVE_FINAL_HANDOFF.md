# Phase 2 — Checkpoint 2 corrective final handoff

## 1. Final owner-QA URL

**Current authorized owner-QA deployment (live):**

https://6ac567c4268f3b2f994edf33--624voice-phase2-owner-qa.netlify.app/

| Field | Value |
|--------|--------|
| Netlify deploy ID | `6ac567c4268f3b2f994edf33` |
| State | Live (draft deploy on owner-QA site) |
| Deployed-source / runtime commit | `80ee91246dd0cffb0f8bbfac192216b82fc00d51` (see Netlify corrective deploy log + authenticated PR #98 health) |
| Deploy log | `review-artifacts/phase2/website-polish/netlify-deploy-corrective.log` |

Supersedes stale URL `https://6ac53bbaacc0499e7f834096--624voice-phase2-owner-qa.netlify.app/` (still reachable; protected or superseded — see `preview-url-inventory-live.json`).

## 2. Owner-QA Basic Auth

Only the **owner-QA Netlify site** is open without visitor HTTP Basic Auth (`PHASE2_OWNER_QA_PREVIEW=1` + `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1`). Production, PR branch deploys (except as configured), and unrelated contexts are **not** authorized open.

## 3. PR #98 protection

**URL:** https://deploy-preview-98--624voice.netlify.app/  
**Netlify deploy ID:** `6ac5678d0a6ca2000754f595`  
**Status:** Fail-closed Basic Auth restored (anonymous **401** on `/`, `/api/health`, and JS assets).  
**Proof:** `review-artifacts/phase2/website-polish/pr98-deploy-preview-auth-proof.json`

## 4. Anonymous owner-QA `/api/health`

Returns only `{"status":"ok"}` with `X-Robots-Tag: noindex, nofollow, noarchive`.  
**Proof:** `review-artifacts/phase2/website-polish/owner-qa-health-anonymous-proof.json`

## 5. SHA table (40-character)

| Role | SHA |
|------|-----|
| Checkpoint 1 progress-label fix | `d5f9df7945bc7ae008480ba9c51634cb4298ea01` |
| Checkpoint 1 score-0 branching fix | `ccf613ccce2c62af0bf2211f921de14c4b1410a2` |
| Last application/runtime CP2 commit | `c6ae9b4ba2b1735bd5849c1e88a18b16c8ec3b01` |
| Last security/config corrective commit | `80ee91246dd0cffb0f8bbfac192216b82fc00d51` |
| Final PR #98 HEAD | See `sha-reconciliation.json` after evidence commit |
| Owner-QA deployed + runtime | `80ee91246dd0cffb0f8bbfac192216b82fc00d51` |
| PR-preview deployed + runtime | `80ee91246dd0cffb0f8bbfac192216b82fc00d51` |

## 6. Changed files (runtime vs evidence)

See `git diff --name-status c6ae9b4ba2b1735bd5849c1e88a18b16c8ec3b01..<FINAL_PR_HEAD>` in `sha-reconciliation.json`. Security corrective touches: `netlify.toml`, `netlify/edge-functions/phase2-owner-qa-gate.ts`, `src/server/deployVersion.ts`, `src/routes/api/health.ts`, Netlify sync scripts.

## 7–9. Architecture, frozen contracts, CTAs

Unchanged from accepted Checkpoint 2: canonical `/assessment`, `/roi-calculator` redirect only, `submitAssessmentLead.ts` active, `generateRoiPdf.ts` dormant, CTAs → `/contact`, `/assessment`, `/book`, `/demo`.

## 10. Fourteen-failure accounting

`review-artifacts/phase2/website-polish/test-failure-14-accounting.md` (890/14 snapshot → 898/6 at `c6ae9b4` → 899/6 after deployVersion health test).

## 11–12. Tests and remaining failures

**Final:** 899 pass / 6 fail / 905 total — `review-artifacts/phase2/website-polish/bun-test-full.log`  
**Build:** `review-artifacts/phase2/website-polish/bun-build.log`  
**Six baseline failures:** `review-artifacts/phase2/website-polish/six-failure-baseline-evidence.json`

## 13. HTTP 404 proof

Route `/does-not-exist-404` returns **404** on owner-QA.  
**Proof:** `not-found-route-proof.json`, screenshots `screenshots/desktop-1280-404.png`, `screenshots/mobile-375-404.png`

## 14. Evidence index

All paths under `review-artifacts/phase2/website-polish/` at final PR HEAD (GitHub blob links pinned after push).

## 15–19. Analytics, legal, production review, deferred report, known issues

- Analytics: in-app/dev sink; conversion intents in `src/lib/analytics/conversionIntent.ts`
- Privacy / Terms / SMS Terms: routes live on preview; **production legal review required**
- Deferred combined downloadable ROI+Assessment PDF
- Known issues: six full-suite failures documented (not CP2 regressions in frozen agent paths)

## 20. Owner visual-review checklist

- [ ] Home, What We Do, How We Work, Demo, About, Contact, Book, Assessment
- [ ] CTAs route per table; `/roi-calculator` redirects to `/assessment`
- [ ] Assessment flow (Checkpoint 1 behavior unchanged)
- [ ] Privacy, Terms, SMS Terms
- [ ] 404 page desktop + mobile

Private implementation remains in progress. Awaiting owner visual review of the revised conversion-focused preview.
