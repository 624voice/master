# 624voice.com preview authentication (standing owner rule)

**Effective:** 2026-10-06

**Owner rule:** Do not require HTTP Basic Auth on 624voice.com preview surfaces (PR deploy previews and phase2 owner-QA Netlify site). Previews remain **noindex** via the edge gate.

**Implementation:** `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1` on deploy-preview contexts and the owner-QA Netlify site. Production `www.624voice.com` is unchanged (no Basic Auth on the public site).

**Security record:** `security-decision-evidence.json` entry `no-basic-auth-standing-rule-2026-10-06`.
