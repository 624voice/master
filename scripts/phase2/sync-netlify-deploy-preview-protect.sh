#!/usr/bin/env bash
# Restore fail-closed HTTP Basic Auth on main-site deploy-preview (PR #98, etc.).
# Uses credentials already stored in Netlify (never printed). Does not open owner-QA site.
set -euo pipefail

MAIN_SITE_ID="${PHASE2_NETLIFY_MAIN_SITE_ID:-4a60ce60-c975-4c5f-901e-451adcbb16ab}"

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$MAIN_SITE_ID"

netlify env:set PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW "1" --context deploy-preview --force
netlify env:unset PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED --context deploy-preview --force 2>/dev/null || true
netlify env:set PHASE2_OWNER_QA_EDGE_BASIC_AUTH_ENABLED "1" --context deploy-preview --force

echo "Main site deploy-preview: fail-closed Basic Auth enabled (credential values not printed)."
