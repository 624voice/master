#!/usr/bin/env bash
# Open dedicated owner-QA Netlify previews (no Basic Auth); noindex via edge gate only.
set -euo pipefail

QA_SITE_ID="${PHASE2_NETLIFY_QA_SITE_ID:-36285e6f-c15f-432b-b50b-718e9cfa0a24}"

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$QA_SITE_ID"

netlify env:set PHASE2_OWNER_QA_PREVIEW "1" --context all --force
netlify env:set PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED "1" --context all --force

echo "Owner-QA site: open preview (no Basic Auth), noindex via edge gate."
