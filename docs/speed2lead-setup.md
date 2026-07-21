# Speed2Lead SMS setup

Speed2Lead sends a scripted SMS conversation when a customer downloads their ROI PDF and opts in on the unlock form.

## Required Netlify environment variables

Set these in Netlify only. **Never commit real values to git.**

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | Outbound SMS number in E.164 format, e.g. `+18178544399` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `TWILIO_WEBHOOK_URL` | Full public URL for inbound SMS: `https://www.624voice.com/api/sms/inbound` |
| `SITE_ORIGIN` | Public site origin, e.g. `https://624voice.com` |
| `SPEED2LEAD_BOOKING_URL` | Optional override for booking link (defaults to config value) |
| `SPEED2LEAD_ENABLED` | Set to `false` to disable without removing credentials |

After first deploy, **rotate the Twilio Auth Token** in Twilio Console and update Netlify if the token was ever shared outside a secure vault.

## Twilio configuration

1. Buy or assign a dedicated SMS number (separate from voice demo lines).
2. Open the number in Twilio Console.
3. Under **Messaging**, set **A message comes in** webhook to:
   - URL: `https://www.624voice.com/api/sms/inbound`
   - Method: `POST`

Use the `www` URL — bare `624voice.com` redirects and can break Twilio signature validation.
4. Complete **A2P 10DLC** brand and campaign registration for production SMS delivery.

## Upstash Redis

Database name suggestion: `624speed2lead`

- Region: US (`us-east-2` recommended)
- Eviction: **Off** (protects STOP/opt-out keys)
- Plan: Free tier is sufficient to start

## How it works

1. Customer unlocks the ROI calculator and checks the SMS consent box.
2. Customer clicks **Download PDF Report**.
3. Server saves the lead, creates a tokenized report link, generates the PDF, and sends the initial SMS.
4. Customer replies; Twilio posts to `/api/sms/inbound`.
5. The conversation state machine sends the next scripted message from Redis-backed session state.
6. Each inbound and outbound SMS is appended to the **SMS Transcripts** tab in your leads Google Sheet.

## SMS transcripts

Transcripts use the same `LEADS_WEBHOOK_URL` as lead capture. After deploying the updated Apps Script (see `docs/leads-webhook-setup.md`), run **setupSheetHeaders** once to create the **SMS Transcripts** tab.

Each row includes timestamp (Central Time), direction, phone, lead name/business, conversation state, and message body.

## Report links

Tokenized links look like:

`https://624voice.com/report/{token}`

Tokens expire after 30 days.

## Verification

1. Opt in on the ROI form and download the PDF.
2. Confirm the initial SMS arrives within a few seconds.
3. Reply `booking more jobs` and walk through a branch to the booking link.
4. Reply `STOP` and confirm no further messages are sent.
5. Download the PDF without opting in and confirm no SMS is sent.
6. Confirm each SMS appears on the **SMS Transcripts** tab in the leads Google Sheet.
