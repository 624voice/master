#!/usr/bin/env bash
# Deploy Phase 2 owner keyboard QA to the dedicated Netlify site (non-production).
set -euo pipefail
cd "$(dirname "$0")/../.."

QA_SITE_ID="${PHASE2_NETLIFY_QA_SITE_ID:-36285e6f-c15f-432b-b50b-718e9cfa0a24}"
PREVIEW_HMAC="${PHASE2_NETLIFY_PREVIEW_HMAC_SECRET:-phase2-netlify-preview-only-hmac-secret-0123456789abcdef0123456789ab}"

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$QA_SITE_ID"

echo "Setting Deploy Preview scoped QA environment (names only in logs)..."
netlify env:set PHASE2_OWNER_QA_PREVIEW "1" --context deploy-preview --force
netlify env:set PHASE2_OWNER_QA_REPORT_FAIL_ONCE "1" --context deploy-preview --force
netlify env:set ASSESSMENT_SECURITY_HMAC_SECRET "$PREVIEW_HMAC" --context deploy-preview --force
netlify env:set ASSESSMENT_ROI_AGENT_LIVE_ENABLED "false" --context deploy-preview --force
netlify env:set SPEED2LEAD_ENABLED "false" --context deploy-preview --force
netlify env:set SPEED2LEAD_LLM_ENABLED "false" --context deploy-preview --force

export PATH="${HOME}/.bun/bin:${PATH}"
bun run build

mkdir -p dist/client
cat > dist/client/_headers <<'EOF'
/*
  X-Robots-Tag: noindex, nofollow, noarchive
EOF

echo "Deploying draft/preview build to QA Netlify site..."
DEPLOY_LOG="$(mktemp)"
netlify deploy --message "phase2-owner-qa-preview" --dir=dist/client --functions=.netlify/v1/functions 2>&1 | tee "$DEPLOY_LOG"
PREVIEW_URL="$(grep -Eo 'https://[a-z0-9-]+--624voice-phase2-owner-qa\.netlify\.app' "$DEPLOY_LOG" | tail -1)"
if [[ -z "$PREVIEW_URL" ]]; then
  PREVIEW_URL="$(grep -Eo 'https://[a-z0-9-]+--[a-z0-9-]+\.netlify\.app' "$DEPLOY_LOG" | tail -1)"
fi
echo "Preview URL: ${PREVIEW_URL}"

PHASE2_NETLIFY_OWNER_QA_BASE_URL="${PREVIEW_URL}" bun run scripts/phase2/generate-owner-walkthrough-v5-markdown.ts
bun run scripts/phase2/audit-owner-walkthrough-markdown.ts

echo "Done. Configure Netlify access control (team login or password) for Deploy Previews on site 624voice-phase2-owner-qa if not already enabled."
