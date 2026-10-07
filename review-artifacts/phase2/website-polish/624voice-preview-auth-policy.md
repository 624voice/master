# 624voice.com preview authentication (Checkpoint 2 corrective)

**Effective:** 2026-10-06 (corrective completion)

| Surface | HTTP Basic Auth | Anonymous `/api/health` | `X-Robots-Tag` |
|---------|-----------------|-------------------------|----------------|
| **Owner-QA Netlify site** (`624voice-phase2-owner-qa`) | **Off** when `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED=1` | `{"status":"ok"}` only | `noindex, nofollow, noarchive` |
| **PR deploy-preview** (`deploy-preview-98--624voice.netlify.app`) | **Fail-closed On** (401 without credentials) | Behind Basic Auth | Same |
| **Production** (`www.624voice.com`) | Off (public site) | Operational policy unchanged | Production policy |

Owner quotations in older JSON entries that cite run `bc-75f79e2f-4e7f-4332-9557-53468a5de498` remain **UNVERIFIED** unless an immutable transcript is linked. See `security-chronology.md`.
