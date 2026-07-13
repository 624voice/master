#!/usr/bin/env bash
# Verify live DNS and HTTPS for 624voice.com after Netlify DNS setup.
set -euo pipefail

DOMAIN="${DOMAIN:-624voice.com}"
WWW="www.${DOMAIN}"
NETLIFY_SUBDOMAIN="${NETLIFY_SUBDOMAIN:-624voice.netlify.app}"
NETLIFY_APEX_IP="${NETLIFY_APEX_IP:-75.2.60.5}"

fail=0

check() {
  local label="$1"
  local output="$2"
  local pattern="$3"

  if echo "$output" | rg -q "$pattern"; then
    echo "ok   $label"
  else
    echo "fail $label"
    echo "     got: $output"
    fail=1
  fi
}

echo "DNS"
www_dns=$(dig "$WWW" +short | tr '\n' ' ')
apex_dns=$(dig "$DOMAIN" +short | tr '\n' ' ')
echo "www:  $www_dns"
echo "apex: $apex_dns"

check "www resolves to Netlify" "$www_dns" "${NETLIFY_SUBDOMAIN}|^[0-9]+\\."
check "apex resolves to Netlify load balancer" "$apex_dns" "${NETLIFY_APEX_IP}"

if echo "$apex_dns" | rg -q '198\.(49|185)\.'; then
  echo "fail apex still points at Squarespace"
  echo "     got: $apex_dns"
  fail=1
else
  echo "ok   apex does not point at Squarespace"
fi

echo
echo "HTTPS"
www_headers=$(curl -skI --max-time 20 "https://${WWW}" 2>&1 | tr '\n' ' ')
apex_headers=$(curl -skI --max-time 20 "https://${DOMAIN}" 2>&1 | tr '\n' ' ')
netlify_headers=$(curl -skI --max-time 20 "https://${NETLIFY_SUBDOMAIN}" 2>&1 | tr '\n' ' ')

check "Netlify app is healthy" "$netlify_headers" "HTTP/2 200"
check "www is served by Netlify" "$www_headers" "server: Netlify"
check "www is not 404" "$www_headers" "HTTP/2 (200|301)"
check "apex is served by Netlify" "$apex_headers" "server: Netlify"

if [[ "$fail" -eq 0 ]]; then
  echo
  echo "All checks passed."
  exit 0
fi

echo
echo "One or more checks failed. Run scripts/configure-netlify-dns.sh with NETLIFY_AUTH_TOKEN if DNS is still missing."
exit 1
