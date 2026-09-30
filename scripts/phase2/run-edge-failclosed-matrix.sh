#!/usr/bin/env bash
# Draft deploys to prove fail-closed misconfiguration (not Chris preview).
set -euo pipefail
cd "$(dirname "$0")/../.."
QA_SITE_ID="${PHASE2_NETLIFY_QA_SITE_ID:-36285e6f-c15f-432b-b50b-718e9cfa0a24}"
netlify link --id "$QA_SITE_ID" >/dev/null

deploy_draft() {
  local label="$1"
  shift
  local log
  log="$(mktemp)"
  netlify deploy --context deploy-preview --message "phase2-failclosed-${label}" \
    --dir=dist/client --functions=.netlify/v1/functions \
    --env "PHASE2_OWNER_QA_PREVIEW=1" --env "NETLIFY_CONTEXT=deploy-preview" \
    "$@" 2>&1 | tee "$log"
  grep -Eo 'https://[a-z0-9-]+--624voice-phase2-owner-qa\.netlify\.app' "$log" | tail -1
}

echo "Fail-closed matrix (both creds missing)..."
URL_BOTH="$(deploy_draft both-missing \
  --env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER=" \
  --env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS=")"
PHASE2_NETLIFY_OWNER_QA_PROBE_URL="$URL_BOTH" PHASE2_EDGE_FAILCLOSED_SCENARIO="both_missing" \
  bun run scripts/phase2/phase2-owner-qa-edge-failclosed-probe.ts

echo "Fail-closed matrix (username missing)..."
URL_USER="$(deploy_draft user-missing \
  --env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER=" \
  --secret-env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS=${PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD:-dummy}")"
PHASE2_NETLIFY_OWNER_QA_PROBE_URL="$URL_USER" PHASE2_EDGE_FAILCLOSED_SCENARIO="username_missing" \
  bun run scripts/phase2/phase2-owner-qa-edge-failclosed-probe.ts

echo "Fail-closed matrix (password missing)..."
URL_PASS="$(deploy_draft pass-missing \
  --env "PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER=owner-qa")"
PHASE2_NETLIFY_OWNER_QA_PROBE_URL="$URL_PASS" PHASE2_EDGE_FAILCLOSED_SCENARIO="password_missing" \
  bun run scripts/phase2/phase2-owner-qa-edge-failclosed-probe.ts

echo "Fail-closed matrix complete."
