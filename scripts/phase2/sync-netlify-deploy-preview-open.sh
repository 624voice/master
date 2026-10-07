#!/usr/bin/env bash
# Open deploy-preview (no Basic Auth): noindex via edge gate only.
set -euo pipefail

MAIN_SITE_ID="${PHASE2_NETLIFY_MAIN_SITE_ID:-4a60ce60-c975-4c5f-901e-451adcbb16ab}"

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$MAIN_SITE_ID"

netlify env:set PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW "1" --context deploy-preview --force
netlify env:set PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED "1" --context deploy-preview --force

echo "Main site deploy-preview: open preview (no Basic Auth), noindex via edge gate."
