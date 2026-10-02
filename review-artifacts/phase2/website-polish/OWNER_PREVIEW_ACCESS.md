# Owner access — protected website-polish preview

## Primary surface (fail-closed)

**Canonical protected URL:** https://6abfd82dde3136ebc350e415--624voice-phase2-owner-qa.netlify.app/

## Credentials (delivered)

Username and password were **rotated and delivered to Chris** via the **Cursor Cloud Agent run artifacts** file `phase2-owner-review-credentials-for-chris.txt` (owner-only; not in Git). Login with those values was **verified** against the canonical URL above.

Sanitized delivery record: [`credential-delivery.json`](credential-delivery.json).

Netlify stores edge auth configuration, but **secret values are not reliably readable from the dashboard after creation**; do not rely on “open Netlify and copy password” unless your team confirms read access.

## PR #98 deploy preview

`https://deploy-preview-98--624voice.netlify.app/` — same fail-closed edge gate on main site **deploy-preview** context. Use the **same** username and password after Netlify finishes a post-rotation rebuild.

## Browser login

1. Open the protected URL.
2. Enter HTTP Basic Auth username and password from the secure delivery above.
3. Confirm `noindex` and that marketing pages load.

Production `www.624voice.com` is **not** protected by this gate.
