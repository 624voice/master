# Phase 2 website polish — final owner handoff (PR #98)

**Branch:** `cursor/website-design-polish-e498`  
**Draft PR:** https://github.com/624voice/master/pull/98  
**Do not merge.** Production is unchanged.

> **Immutable evidence:** Pin links to the final 40-character PR HEAD SHA in the table below (`FINAL_PR_HEAD_SHA`).

---

## 1. Legacy public deploy (accepted — not re-run)

Legacy deploy deletion and disclosed-preview inventory remain as previously verified unless a new deploy changes exposure.

---

## 2. Final commit, runtime, and diff classification

| Role | SHA |
|------|-----|
| Last **runtime-changing** commit (fail-closed edge gate + deploy-preview protect) | `c6b80aef650c01dd4520f771d3295ad5d792327a` |
| Deploy-script-only | `0406a0b15f9ab773d99d61d01fa925d859de6f60` |
| **Application runtime** (owner-QA + PR preview `/api/health`) | `d0f528cf25d5382a5e1182bb122a6a98c94e541e` |
| **Final PR #98 HEAD** | `c77787f8e12eb8dd393c0b038b9a7e760c69fe94` |

**Post-`d0f528c…` diff (non-runtime):** review artifacts, logs, handoff docs, **`scripts/phase2/audit-disclosed-preview-urls.ts`** (one-line canonical URL constant for live audit tooling — **not** shipped application code), baseline runner path fixes, and **`scripts/phase2/run-test-failure-baseline-v2.sh`**. No other non-artifact application paths.

**Canonical protected owner-QA:** `https://6abfd82dde3136ebc350e415--624voice-phase2-owner-qa.netlify.app/`  
**PR #98 deploy preview:** `https://deploy-preview-98--624voice.netlify.app/`

---

## 3. Owner credentials (delivered and verified)

| Question | Answer |
|----------|--------|
| Chris received **username**? | **Yes** — included in owner-only run artifact (not in Git). |
| Chris received **password**? | **Yes** — same artifact (Netlify secret values are not reliably readable from dashboard after creation). |
| Secure channel | **Cursor Cloud Agent run artifacts** — file basename `phase2-owner-review-credentials-for-chris.txt` (owner-only upload with this run). |
| Verified against canonical URL? | **Yes** — authenticated `/api/health` returned runtime SHA `d0f528c…` after rotation. |

Sanitized record (no secrets): [`credential-delivery.json`](credential-delivery.json). Login steps: [`OWNER_PREVIEW_ACCESS.md`](OWNER_PREVIEW_ACCESS.md).

---

## 4. Tests (true pre-polish baseline)

**Pre-polish baseline:** `4d5491e757e8485c49d193417e96aef1b8a8c2ce` (parent of polish commit `3bfa602…`).

- Pre-polish full suite: **827 pass, 9 fail** — [`full-suite-pre-polish-baseline.log`](full-suite-pre-polish-baseline.log)
- Runtime / PR HEAD full suite: **837 pass, 10 fail** — [`bun-test-full.log`](bun-test-full.log)
- Matrix: [`test-failure-analysis.md`](test-failure-analysis.md), [`test-failure-baseline.json`](test-failure-baseline.json)

**Do not claim** all failures were “pre-existing”; **one** failure class (`X-SAFE-PREVIEW-FOCUS-04`) is **introduced by polish** (fleet label copy vs test expectations). **Nine** others are reproduced at the true baseline under equivalent full-suite / isolated conditions (see analysis).

---

## 5. Evidence index (use immutable GitHub URLs at FINAL_PR_HEAD_SHA)

- [FINAL_OWNER_HANDOFF.md](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/FINAL_OWNER_HANDOFF.md)
- [test-failure-analysis.md](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/test-failure-analysis.md)
- [test-failure-baseline.json](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/test-failure-baseline.json)
- [bun-test-full.log](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/bun-test-full.log)
- [full-suite-pre-polish-baseline.log](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/full-suite-pre-polish-baseline.log)
- [credential-delivery.json](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/credential-delivery.json)
- [SCREENSHOTS.md](https://github.com/624voice/master/blob/c77787f8e12eb8dd393c0b038b9a7e760c69fe94/review-artifacts/phase2/website-polish/SCREENSHOTS.md)

---

## 6. Known issues

- Full suite **10 fail** at runtime (documented; not all pre-existing).
- PR #98 deploy-preview may require Netlify rebuild after auth rotation to accept the new password (push-triggered build).
- Assessment Results screenshot remains fixture-based (no live lead/SMS).

---

Private implementation remains in progress. Awaiting owner visual review of the protected final website-polish preview.
