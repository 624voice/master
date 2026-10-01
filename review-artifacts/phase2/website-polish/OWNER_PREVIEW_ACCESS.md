# Owner access — protected website-polish preview

## Primary surface (fail-closed)

Use the **dedicated owner-QA Netlify deploy** URL printed in the latest deploy log for site `624voice-phase2-owner-qa` (draft deploy under `deploy-preview` context).

## Login

1. Open the protected preview URL in a browser.
2. When prompted for **HTTP Basic Authentication**, enter the credentials stored in Netlify for site **624voice-phase2-owner-qa**:
   - Environment variable `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER`
   - Secret `PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS`
3. Credentials are **not** in the repository. Retrieve them from the Netlify team dashboard (Site → Environment variables) or from your secure credential store if the agent provisioned them during deploy.

## PR #98 deploy preview (`deploy-preview-98--624voice.netlify.app`)

This URL uses the **same fail-closed edge gate** via `PHASE2_EDGE_PROTECT_DEPLOY_PREVIEW=1` on the main `624voice` Netlify site’s **deploy-preview** context, with the same Basic Auth variables scoped to deploy-preview only. It is **not** a second anonymous path to the private build.

Production `www.624voice.com` is **not** protected by this gate (edge enforcement is off outside owner-QA / protected deploy-preview contexts).
