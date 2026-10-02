# Owner access — website-polish preview (open, no password)

Previews are **not** password-protected. Use a normal browser visit (no HTTP Basic Auth).

## URLs

- **PR #98 deploy preview:** https://deploy-preview-98--624voice.netlify.app/
- **Dedicated owner-QA Netlify site:** https://6ac0032955a8948d0300a5b8--624voice-phase2-owner-qa.netlify.app/

Responses include **`noindex`** headers so previews are not intended for public search indexing. Production **www.624voice.com** is unchanged.

## No credentials

Basic Auth has been disabled (`PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1`). Any prior credential artifact is obsolete for preview access.
