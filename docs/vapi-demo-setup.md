# Vapi voice demo setup

The `/demo` page lets prospects submit lead info, then start a live browser call with Jessica (Vapi assistant). When the call ends, the transcript is emailed to **info@624voice.com** and logged to the **Voice Transcripts** tab in your leads Google Sheet.

## Netlify environment variables

Set these in Netlify → **Site configuration → Environment variables**. **Do not commit real keys to git.**

| Variable | Description |
|----------|-------------|
| `VITE_VAPI_PUBLIC_KEY` | Vapi **public** key (browser-safe) |
| `VITE_VAPI_ASSISTANT_ID` | Jessica assistant ID (optional — defaults to configured id in code) |
| `VAPI_PRIVATE_KEY` | Vapi **private** key — server only, never use `VITE_` prefix |
| `LEADS_WEBHOOK_URL` | Existing Apps Script web app URL (leads + transcripts) |
| `SITE_ORIGIN` | e.g. `https://624voice.com` |

Redeploy production after saving env vars.

## Vapi dashboard

1. Open your Jessica assistant (`14034cb9-f583-4010-b54f-a81177744e01`).
2. Set **Server URL** to:
   ```
   https://www.624voice.com/api/vapi/webhook
   ```
3. Ensure **end-of-call-report** is enabled in server messages for the assistant.
4. Set max call duration to **6 minutes** in the assistant settings (backup to the client override).

## Google Sheet / Apps Script

1. Re-paste the latest [`scripts/leads-webhook.gs`](../scripts/leads-webhook.gs) into Apps Script.
2. Run **setupSheetHeaders** once (creates **Voice Transcripts** tab).
3. Optional: run **testVoiceTranscriptWebhook** to verify sheet row + email.
4. **Deploy → Manage deployments → Edit → New version → Deploy**.

Main leads tab will show **Source = Voice Demo** for demo form submissions.

## One call per visitor

Each email **or** phone number may start the web demo **once**. Usage is tracked in Upstash Redis (same database as Speed2Lead). Repeat visitors see a booking panel with the embedded Google Calendar instead of the call UI.

## Verification

1. Visit `/demo`, fill out the form, click **Continue to demo**.
2. Confirm a new lead row on the main sheet (Source = Voice Demo).
3. Click **Start conversation** — allow microphone access.
4. Talk with Jessica, then end the call.
5. Confirm transcript email at info@624voice.com.
6. Confirm one row on the **Voice Transcripts** tab.

## Security note

If API keys were shared in chat or email, rotate them in the Vapi dashboard and update Netlify env vars.
