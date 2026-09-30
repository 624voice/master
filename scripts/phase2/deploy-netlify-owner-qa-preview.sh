#!/usr/bin/env bash
# Deploy Phase 2 owner keyboard QA to the dedicated Netlify site (non-production).
set -euo pipefail
cd "$(dirname "$0")/../.."

QA_SITE_ID="${PHASE2_NETLIFY_QA_SITE_ID:-36285e6f-c15f-432b-b50b-718e9cfa0a24}"
PREVIEW_HMAC="${PHASE2_NETLIFY_PREVIEW_HMAC_SECRET:-phase2-netlify-preview-only-hmac-secret-0123456789abcdef0123456789ab}"

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$QA_SITE_ID"

echo "Setting Deploy Preview scoped QA environment (names only in logs)..."
# QA-only site: scope vars to all contexts; runtime boundary still requires deploy-preview CONTEXT.
netlify env:set PHASE2_OWNER_QA_PREVIEW "1" --context all --force
netlify env:set PHASE2_OWNER_QA_REPORT_FAIL_ONCE "1" --context all --force
netlify env:set ASSESSMENT_SECURITY_HMAC_SECRET "$PREVIEW_HMAC" --context all --force
netlify env:set ASSESSMENT_ROI_AGENT_LIVE_ENABLED "false" --context all --force
netlify env:set SPEED2LEAD_ENABLED "false" --context all --force
netlify env:set SPEED2LEAD_LLM_ENABLED "false" --context all --force

export PATH="${HOME}/.bun/bin:${PATH}"
export CONTEXT=deploy-preview
export NETLIFY_CONTEXT=deploy-preview
export PHASE2_OWNER_QA_PREVIEW=1
export SPEED2LEAD_LLM_ENABLED=false
export SPEED2LEAD_ENABLED=false
bun run build

mkdir -p dist/client

# Optional Basic Auth: set both PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER and _PASSWORD before deploy.
PREVIEW_AUTH_USER="${PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER:-}"
PREVIEW_AUTH_PASS="${PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD:-}"
DEPLOY_AUTH_ARGS=()
if [[ -n "$PREVIEW_AUTH_USER" && -n "$PREVIEW_AUTH_PASS" ]]; then
  DEPLOY_AUTH_ARGS=(
    --env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER=${PREVIEW_AUTH_USER}"
    --secret-env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS=${PREVIEW_AUTH_PASS}"
  )
  echo "Deploy includes edge Basic Auth (user set)."
else
  echo "Deploy without edge Basic Auth (public owner-QA preview; X-Robots-Tag noindex only)."
fi

# X-Robots-Tag works on all plans; Basic-Auth in _headers requires Pro+.
cat > dist/client/_headers <<EOF
/*
  X-Robots-Tag: noindex, nofollow, noarchive
EOF

NETLIFY_TOML_BACKUP=""
if [[ -f netlify.toml ]]; then
  NETLIFY_TOML_BACKUP="$(mktemp)"
  cp netlify.toml "$NETLIFY_TOML_BACKUP"
fi
cat >> netlify.toml <<'TOML'

# Phase 2 owner QA deploy (CLI) — appended by deploy-netlify-owner-qa-preview.sh; restored after deploy.
[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow, noarchive"
TOML

echo "Deploying draft/preview build to QA Netlify site (deploy-preview context)..."
DEPLOY_LOG="$(mktemp)"
netlify deploy \
  --context deploy-preview \
  --message "phase2-owner-qa-preview" \
  --dir=dist/client \
  --functions=.netlify/v1/functions \
  --env "PHASE2_OWNER_QA_PREVIEW=1" \
  --env "NETLIFY_CONTEXT=deploy-preview" \
  --env "PHASE2_OWNER_QA_REPORT_FAIL_ONCE=1" \
  --env "ASSESSMENT_ROI_AGENT_LIVE_ENABLED=false" \
  --env "SPEED2LEAD_ENABLED=false" \
  --env "SPEED2LEAD_LLM_ENABLED=false" \
  "${DEPLOY_AUTH_ARGS[@]}" \
  --secret-env "ASSESSMENT_SECURITY_HMAC_SECRET=${PREVIEW_HMAC}" \
  2>&1 | tee "$DEPLOY_LOG"

if [[ -n "$NETLIFY_TOML_BACKUP" ]]; then
  mv "$NETLIFY_TOML_BACKUP" netlify.toml
fi
PREVIEW_URL="$(grep -Eo 'https://[a-z0-9-]+--624voice-phase2-owner-qa\.netlify\.app' "$DEPLOY_LOG" | tail -1)"
if [[ -z "$PREVIEW_URL" ]]; then
  PREVIEW_URL="$(grep -Eo 'https://[a-z0-9-]+--[a-z0-9-]+\.netlify\.app' "$DEPLOY_LOG" | tail -1)"
fi
echo "Preview URL: ${PREVIEW_URL}"

PHASE2_NETLIFY_OWNER_QA_BASE_URL="${PREVIEW_URL}" bun run scripts/phase2/generate-owner-walkthrough-v5-markdown.ts
bun run scripts/phase2/audit-owner-walkthrough-markdown.ts

echo "Done. Preview is open unless PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_* were set for this deploy."
