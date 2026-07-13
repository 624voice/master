#!/usr/bin/env bash
# Configure 624voice.com on Netlify and create the DNS records in Netlify DNS.
# Use when nameservers already point at Netlify (dns*.nsone.net).
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
    echo "Create one at https://app.netlify.com/user/applications#personal-access-tokens" >&2
    echo "Then run: NETLIFY_AUTH_TOKEN=... bash scripts/configure-netlify-dns.sh" >&2
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

resolve_site_id() {
  local payload
  payload=$(netlify_api GET "/sites/${SITE_ID}")
  echo "$payload" | jq -r '.id'
}

configure_site_domains() {
  local site_id="$1"

  echo "Setting primary domain to ${PRIMARY_DOMAIN} and apex alias ${APEX_DOMAIN}..."
  netlify_api PATCH "/sites/${site_id}" "$(jq -nc \
    --arg custom_domain "$PRIMARY_DOMAIN" \
    --arg apex "$APEX_DOMAIN" \
    '{custom_domain: $custom_domain, domain_aliases: [$apex]}')" >/dev/null

  echo "Linking Netlify DNS to site..."
  netlify_api PUT "/sites/${site_id}/dns" || true
}

ensure_dns_zone() {
  local site_id="$1"
  local zone_id=""

  zone_id=$(netlify_api GET "/dns_zones/${APEX_DOMAIN}" 2>/dev/null | jq -r '.id // empty' || true)
  if [[ -n "$zone_id" ]]; then
    echo "$zone_id"
    return
  fi

  echo "Creating Netlify DNS zone for ${APEX_DOMAIN}..." >&2
  zone_id=$(netlify_api POST "/dns_zones" "$(jq -nc \
    --arg domain "$APEX_DOMAIN" \
    --arg site_id "$site_id" \
    '{name: $domain, site_id: $site_id}')" | jq -r '.id')

  echo "$zone_id"
}

list_dns_records() {
  local zone_id="$1"
  netlify_api GET "/dns_zones/${zone_id}/dns_records"
}

record_exists() {
  local records="$1"
  local type="$2"
  local hostname="$3"
  local value="$4"

  echo "$records" | jq -e --arg type "$type" --arg hostname "$hostname" --arg value "$value" \
    '.[] | select(.type == $type and .hostname == $hostname and .value == $value)' >/dev/null
}

create_dns_record() {
  local zone_id="$1"
  local type="$2"
  local hostname="$3"
  local value="$4"
  local ttl="${5:-3600}"

  netlify_api POST "/dns_zones/${zone_id}/dns_records" "$(jq -nc \
    --arg type "$type" \
    --arg hostname "$hostname" \
    --arg value "$value" \
    --argjson ttl "$ttl" \
    '{type: $type, hostname: $hostname, value: $value, ttl: $ttl}')"
}

preserve_email_records() {
  local records="$1"
  local email_records

  email_records=$(echo "$records" | jq -c '[.[] | select(.type == "MX" or .type == "TXT")]')
  if [[ "$email_records" != "[]" ]]; then
    echo "Preserving existing email/authentication records:"
    echo "$email_records" | jq -r '.[] | "  \(.type) \(.hostname) -> \(.value)"'
  else
    echo "No MX/TXT records found in Netlify DNS (email not configured yet)."
  fi
}

ensure_required_dns_records() {
  local zone_id="$1"
  local records

  records=$(list_dns_records "$zone_id")
  preserve_email_records "$records"

  if record_exists "$records" "CNAME" "www" "$NETLIFY_SUBDOMAIN"; then
    echo "ok   CNAME www -> ${NETLIFY_SUBDOMAIN} already exists"
  else
    echo "Adding CNAME www -> ${NETLIFY_SUBDOMAIN}..."
    create_dns_record "$zone_id" "CNAME" "www" "$NETLIFY_SUBDOMAIN" 300 >/dev/null
    echo "ok   CNAME www created"
  fi

  if record_exists "$records" "A" "$APEX_DOMAIN" "$NETLIFY_APEX_IP"; then
    echo "ok   A ${APEX_DOMAIN} -> ${NETLIFY_APEX_IP} already exists"
  elif record_exists "$records" "A" "" "$NETLIFY_APEX_IP"; then
    echo "ok   A @ -> ${NETLIFY_APEX_IP} already exists"
  else
    echo "Adding A ${APEX_DOMAIN} -> ${NETLIFY_APEX_IP}..."
    create_dns_record "$zone_id" "A" "$APEX_DOMAIN" "$NETLIFY_APEX_IP" 14400 >/dev/null || \
      create_dns_record "$zone_id" "A" "" "$NETLIFY_APEX_IP" 14400 >/dev/null
    echo "ok   A apex created"
  fi
}

provision_ssl() {
  local site_id="$1"

  echo "Provisioning SSL certificate for ${PRIMARY_DOMAIN}..."
  netlify_api PATCH "/sites/${site_id}" "$(jq -nc \
    --arg custom_domain "$PRIMARY_DOMAIN" \
    '{custom_domain: $custom_domain, domain_aliases: []}')" >/dev/null
  netlify_api POST "/sites/${site_id}/ssl" '{}' || true

  echo "Waiting for SSL certificate..."
  for _ in $(seq 1 30); do
    if [[ "$(netlify_api GET "/sites/${site_id}" | jq -r '.ssl')" == "true" ]]; then
      echo "ok   SSL certificate is active"
      break
    fi
    sleep 10
  done

  echo "Re-attaching apex alias..."
  netlify_api PATCH "/sites/${site_id}" "$(jq -nc \
    --arg custom_domain "$PRIMARY_DOMAIN" \
    --arg apex "$APEX_DOMAIN" \
    '{custom_domain: $custom_domain, domain_aliases: [$apex], force_ssl: true}')" >/dev/null || \
  netlify_api PATCH "/sites/${site_id}" "$(jq -nc \
    --arg custom_domain "$PRIMARY_DOMAIN" \
    --arg apex "$APEX_DOMAIN" \
    '{custom_domain: $custom_domain, domain_aliases: [$apex]}')" >/dev/null
}

print_next_steps() {
  cat <<EOF

Netlify DNS configuration complete.
===================================
Primary domain: ${PRIMARY_DOMAIN}
Apex alias:     ${APEX_DOMAIN}

Required records in Netlify DNS:
  CNAME www -> ${NETLIFY_SUBDOMAIN}
  A ${APEX_DOMAIN} -> ${NETLIFY_APEX_IP}

Verify after propagation (usually a few minutes):
  bash scripts/verify-domain.sh

EOF
}

require_auth

echo "Resolving Netlify site ${SITE_ID}..."
site_id=$(resolve_site_id)
echo "Site ID: ${site_id}"

configure_site_domains "$site_id"
zone_id=$(ensure_dns_zone "$site_id")
echo "DNS zone ID: ${zone_id}"

ensure_required_dns_records "$zone_id"
provision_ssl "$site_id"
print_next_steps
