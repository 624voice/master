# Owner access — protected website-polish preview

## Primary surface (fail-closed HTTP Basic Auth)

**Canonical protected owner-QA URL:** set by latest protected deploy (see `legacy-deploy-removal-evidence.json` / handoff after security restore).

**PR #98 deploy preview:** https://deploy-preview-98--624voice.netlify.app/

## Login

1. Open the protected preview URL in a browser.
2. When prompted for **HTTP Basic Authentication**, use credentials from the current owner-only secure artifact (`phase2-owner-review-credentials-for-chris.txt` on the Cloud Agent run that performed the **post-incident rotation**). Prior credential files are **obsolete**.
3. Credentials are **not** in the repository.

Netlify environment variables hold edge auth configuration; secret values are not reliably readable from the dashboard after creation.

## Regression note

Open-preview configuration (`PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED`) from commits `f01355fc794eee866e2bb3869c26150540a75184` and `37d9a43b131408d1d57b850fa6e319658f639394` was **unauthorized and reverted**. Previews are fail-closed again.

Production `www.624voice.com` is **not** protected by this gate.
