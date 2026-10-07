# Phase 2 preview security chronology (readable)

This chronology separates **attribution** (who authorized a change) from **containment** (what the systems actually did). Agent-authored JSON entries do **not** independently verify owner quotations unless an immutable transcript is linked.

## Standing rules (current)

| Control | Owner-QA Netlify site | PR #98 deploy-preview (`deploy-preview-98--624voice.netlify.app`) | Production |
|--------|------------------------|---------------------------------------------------------------------|------------|
| HTTP Basic Auth | **Open** when `PHASE2_OWNER_QA_PREVIEW=1` and `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1` (Checkpoint 2 corrective scope) | **Fail-closed Basic Auth** when `PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW=1` and credentials configured | No visitor Basic Auth |
| `X-Robots-Tag` | `noindex, nofollow, noarchive` via edge gate | Same | Production policy unchanged |
| Anonymous `/api/health` | Minimal `{"status":"ok"}` only (no SHAs/flags) | Behind Basic Auth | Unchanged |

## Incident: second open preview and restore (2026-10-05)

**Attribution:** `UNVERIFIED` for opening previews. The opening commit message (“Explicit owner request for deploy-preview-98 and phase2 owner-QA surfaces”) is a **self-asserted agent claim**, not independent authorization evidence.

### Intervals (do not conflate)

| Interval type | Value | Evidence |
|---------------|--------|----------|
| **Git correction interval** | **66 minutes 8 seconds** | `c06761d7aa70619520bd80f109d384a1f58ad6e2` @ 2026-10-05T16:18:36Z → `d041587f7a6c8e731691d00587fc39141db69a7b` @ 2026-10-05T17:24:44Z |
| **Owner-QA live open window (deploy-ready proxy)** | **66 minutes 38.277 seconds** | Netlify deploy `6ac3ce0b4ddd1b7b069d8a19` ready @ 2026-10-05T16:20:00.782Z (`updated_at`; `published_at` null) → protected deploy `6ac3dda882a472ad10fb0280` ready @ 2026-10-05T17:26:39.059Z |
| **PR #98 deploy-preview live open window (deploy-ready proxy)** | **66 minutes 4.703 seconds** | Main-site deploy `6ac3cde417611f0008ae73bd` ready @ 2026-10-05T16:19:50.257Z → deploy `6ac3dd64bcbba5000899e071` ready @ 2026-10-05T17:25:54.960Z |

**NOT PRESERVED:** timestamped anonymous HTTP 200 captures during the open deploy window. **Archived after restore:** `preview-auth-evidence.json` (401 anonymous `/` and `/api/health`, verified ~2026-10-05T17:30:00Z).

**Restoring commit scope:** `d041587f…` is **not** security-only—it is a broad homepage/conversion commit; protection restored via `netlify.toml` + `deploy-netlify-owner-qa-preview.sh` / edge-auth sync (see Git diff).

Full machine-readable timeline: `security-decision-evidence.json` → `second-open-preview-and-restore-2026-10-05`.

### Later regressions (2026-10-06)

| Event | Evidence |
|-------|----------|
| PR #98 anonymous 200 pre-corrective | Live verification; fixed in `80ee91246dd0cffb0f8bbfac192216b82fc00d51` |
| Owner-QA health metadata leak | Sanitized in same commit; anonymous `{"status":"ok"}` only |

## Checkpoint 2 corrective (2026-10-06)

- **Owner-QA only:** Chris’s Checkpoint 2 governing instruction authorizes open owner-QA for website review (recorded as scoped waiver; not extended to PR #98).
- **PR #98:** Restored fail-closed Basic Auth via Netlify deploy-preview env + edge gate logic (`sync-netlify-deploy-preview-protect.sh`).
- **Health metadata:** Removed anonymous disclosure of Git SHA, branch, deploy context, and Speed2Lead flags on open owner-QA.

## Evidence files

- Machine-readable decisions: `security-decision-evidence.json`
- PR #98 auth proof: `pr98-deploy-preview-auth-proof.json` (sanitized headers only)
- Owner-QA health proof: `owner-qa-health-anonymous-proof.json`
- Preview URL inventory: `preview-url-inventory.json` (refreshed after live audit)
