#!/usr/bin/env bash
# Deploy Phase 2 owner keyboard QA to Vercel Preview (non-production).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is required" >&2
  exit 1
fi

PREVIEW_HMAC="${PHASE2_VERCEL_PREVIEW_HMAC_SECRET:-phase2-vercel-preview-only-hmac-secret-0123456789abcdef0123456789ab}"

echo "Setting Preview-scoped owner QA environment (names only; values not printed)..."
for pair in \
  "PHASE2_VERCEL_OWNER_QA=1" \
  "PHASE2_OWNER_QA_REPORT_FAIL_ONCE=1" \
  "ASSESSMENT_SECURITY_HMAC_SECRET=${PREVIEW_HMAC}" \
  "ASSESSMENT_ROI_AGENT_LIVE_ENABLED=false" \
  "SPEED2LEAD_ENABLED=false" \
  "SPEED2LEAD_LLM_ENABLED=false"; do
  key="${pair%%=*}"
  val="${pair#*=}"
  printf '%s' "$val" | bunx vercel@latest env add "$key" preview --force --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
done

echo "Deploying preview..."
DEPLOY_URL="$(bunx vercel@latest deploy --yes --token "$VERCEL_TOKEN" 2>&1 | tee /tmp/vercel-deploy.log | tail -1)"
echo "Preview URL: ${DEPLOY_URL}"

echo "Regenerating owner walkthrough for Vercel base URL..."
PHASE2_VERCEL_OWNER_QA_BASE_URL="${DEPLOY_URL}" bun run scripts/phase2/generate-owner-walkthrough-v5-markdown.ts

echo "Done. Enable Vercel Deployment Protection (password or SSO) on this preview in the Vercel dashboard before owner QA."
