# Phase 2 preview security chronology (readable)

This chronology separates **attribution** (who authorized a change) from **containment** (what the systems actually did). Agent-authored JSON entries do **not** independently verify owner quotations unless an immutable transcript is linked.

## Standing rules (current)

| Control | Owner-QA Netlify site | PR #98 deploy-preview (`deploy-preview-98--624voice.netlify.app`) | Production |
|--------|------------------------|---------------------------------------------------------------------|------------|
| HTTP Basic Auth | **Open** when `PHASE2_OWNER_QA_PREVIEW=1` and `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1` (Checkpoint 2 corrective scope) | **Fail-closed Basic Auth** when `PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW=1` and credentials configured | No visitor Basic Auth |
| `X-Robots-Tag` | `noindex, nofollow, noarchive` via edge gate | Same | Production policy unchanged |
| Anonymous `/api/health` | Minimal `{"status":"ok"}` only (no SHAs/flags) | Behind Basic Auth | Unchanged |

## Incident: second open preview and restore (2026-10-05)

**Attribution:** `UNVERIFIED` for the instruction to open previews (`open-preview-owner-review-2026-10-05`). Chris has not confirmed the agent-recorded quotations from memory; see `security-decision-evidence.json`.

**Technical history (Git-proven where SHA listed):**

| Phase | Claimed fact | Evidence type | Notes |
|-------|----------------|---------------|-------|
| Open | Previews opened for review | Agent narrative + commit `c06761d7aa70619520bd80f109d384a1f58ad6e2` cited in JSON | Opening commit diff should be inspected for `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED` and sync-open scripts |
| Restore | Fail-closed auth restored | Git commit `d041587f7a6c8e731691d00587fc39141db69a7b` cited in JSON | Archived live checks on 2026-10-05 reported anonymous 401 on PR preview and owner-QA |
| Regression | Previews opened again during conversion pass | Live verification 2026-10-06: PR #98 returned HTTP 200 anonymously | Corrective action: unset `DISABLED` on deploy-preview, enforce auth in edge gate, redeploy |

If a row lacks independent Netlify deploy ID / timestamp / live capture, treat the **event** as **unproven** even when a commit SHA exists.

## Checkpoint 2 corrective (2026-10-06)

- **Owner-QA only:** Chris’s Checkpoint 2 governing instruction authorizes open owner-QA for website review (recorded as scoped waiver; not extended to PR #98).
- **PR #98:** Restored fail-closed Basic Auth via Netlify deploy-preview env + edge gate logic (`sync-netlify-deploy-preview-protect.sh`).
- **Health metadata:** Removed anonymous disclosure of Git SHA, branch, deploy context, and Speed2Lead flags on open owner-QA.

## Evidence files

- Machine-readable decisions: `security-decision-evidence.json`
- PR #98 auth proof: `pr98-deploy-preview-auth-proof.json` (sanitized headers only)
- Owner-QA health proof: `owner-qa-health-anonymous-proof.json`
- Preview URL inventory: `preview-url-inventory.json` (refreshed after live audit)
