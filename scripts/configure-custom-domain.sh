#!/usr/bin/env bash
# Configure www.624voice.com and 624voice.com on the Netlify site and print
# the Squarespace DNS records required to complete external DNS setup.
set -euo pipefail

SITE_ID="${NETLIFY_SITE_ID:-624voice.netlify.app}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-www.624voice.com}"
APEX_DOMAIN="${APEX_DOMAIN:-624voice.com}"
NETLIFY_SUBDOMAIN="${NETLIFY_SUBDOMAIN:-624voice.netlify.app}"
NETLIFY_LB="${NETLIFY_LB:-apex-loadbalancer.netlify.com}"
NETLIFY_APEX_IP="${NETLIFY_APEX_IP:-75.2.60.5}"

require_auth() {
  if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
    echo "error: NETLIFY_AUTH_TOKEN is required." >&2
    echo "Run: npx netlify login" >&2
    echo "Or export NETLIFY_AUTH_TOKEN from https://app.netlify.com/user/applications#personal-access-tokens" >&2
    exit 1
  fi
}

netlify_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -fsS -X "$method" "https://api.netlify.com/api/v1${path}" \
      -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -fsS -X "$method" "https://api.netlify.com/api/v1${path}" \
      -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}"
  fi
}

print_squarespace_dns() {
  cat <<EOF

Squarespace DNS records for ${APEX_DOMAIN}
==========================================
Nameservers stay on Squarespace (nsb*.squarespacedns.com).

1) www (CNAME)
   Type: CNAME
   Host/Name: www
   Data: ${NETLIFY_SUBDOMAIN}

2) apex (@)
   Preferred (if Squarespace supports ALIAS/ANAME/flattened CNAME):
   Type: ALIAS or ANAME
   Host/Name: @
   Data: ${NETLIFY_LB}

   Fallback (if ALIAS is unavailable):
   Type: A
   Host/Name: @
   Data: ${NETLIFY_APEX_IP}

3) Remove conflicting records
   - Delete any www CNAME pointing at *.ctonew.app or other preview proxies
   - Delete Squarespace A records on @ that point at 198.49.* / 198.185.*

After saving DNS, allow up to 4 hours for propagation, then verify:
  dig @1.1.1.1 www.${APEX_DOMAIN} +short
  dig @1.1.1.1 ${APEX_DOMAIN} +short
  curl -sI https://www.${APEX_DOMAIN}
  curl -sI https://${APEX_DOMAIN}

EOF
}

require_auth

echo "Updating Netlify site ${SITE_ID}..."
netlify_api PATCH "/sites/${SITE_ID}" "$(jq -nc \
  --arg custom_domain "$PRIMARY_DOMAIN" \
  --arg apex "$APEX_DOMAIN" \
  '{custom_domain: $custom_domain, domain_aliases: [$apex], force_ssl: true}')"

echo "Provisioning SSL certificate..."
netlify_api POST "/sites/${SITE_ID}/ssl" '{}' || true

echo
echo "Netlify domain configuration requested."
echo "Primary domain: ${PRIMARY_DOMAIN}"
echo "Alias domain: ${APEX_DOMAIN}"
print_squarespace_dns
