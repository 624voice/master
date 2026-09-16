#!/usr/bin/env bash
set -euo pipefail

cd /app

export PHASE2_SAFE_PREVIEW=1
export NODE_ENV=production
export SITE_ORIGIN=http://127.0.0.1:3000
export UPSTASH_REDIS_REST_URL=http://127.0.0.1:8787
export UPSTASH_REDIS_REST_TOKEN=phase2-safe-preview-stub-token
export LEADS_WEBHOOK_URL=http://127.0.0.1:8787/leads-webhook
export ASSESSMENT_SECURITY_HMAC_SECRET=phase2-safe-preview-local-hmac-secret-0123456789abcdef
export ASSESSMENT_ROI_AGENT_LIVE_ENABLED=false
export SPEED2LEAD_ENABLED=false
export SPEED2LEAD_LLM_ENABLED=false

echo "Container: applying fail-closed egress deny (iptables)..."
if ! command -v iptables >/dev/null 2>&1; then
  echo "ERROR: iptables unavailable inside container. Safe preview cannot start."
  echo "Do NOT continue with a weaker preview mode."
  exit 1
fi
iptables -F OUTPUT 2>/dev/null || {
  echo "ERROR: cannot configure iptables (NET_ADMIN required). Do NOT continue."
  exit 1
}
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -j DROP
echo "Container: egress deny active (loopback + established only)."

if [[ ! -d node_modules ]]; then
  echo "ERROR: node_modules missing inside container."
  echo "Run once on the host (with network): bun run scripts/phase2/prepare-safe-preview-deps.ts"
  exit 1
fi

echo "Container: frozen lockfile install..."
bun install --frozen-lockfile

echo "Container: sanitized build..."
bun --env-file=/dev/null scripts/phase2/safePreviewBuild.ts

echo "Container: starting Redis stub..."
bun --env-file=/dev/null scripts/phase2/upstash-redis-stub.ts &
REDIS_PID=$!

cleanup() {
  kill "$REDIS_PID" 2>/dev/null || true
}
trap cleanup EXIT

sleep 1
echo "Container: starting preview on 0.0.0.0:3000 (published to host 127.0.0.1:3000 only)..."
exec bun --env-file=/dev/null scripts/phase2/safe-preview-serve.ts
