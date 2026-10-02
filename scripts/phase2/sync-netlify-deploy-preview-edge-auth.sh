#!/usr/bin/env bash
# Mirror edge Basic Auth env vars onto the main 624voice site's deploy-preview context.
# Credentials are read from the environment (never echoed). Run after provisioning QA auth.
set -euo pipefail

MAIN_SITE_ID="${PHASE2_NETLIFY_MAIN_SITE_ID:-4a60ce60-c975-4c5f-901e-451adcbb16ab}"
USER="${PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER:-}"
PASS="${PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD:-}"

if [[ -z "$USER" || -z "$PASS" ]]; then
  echo "PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER and PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD are required." >&2
  exit 1
fi

netlify unlink >/dev/null 2>&1 || true
netlify link --id "$MAIN_SITE_ID"

netlify env:set PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW "1" --context deploy-preview --force
netlify env:set PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER "$USER" --context deploy-preview --force
netlify env:set PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS "$PASS" --context deploy-preview --secret --force

echo "Main site deploy-preview edge auth synced (values not printed)."
