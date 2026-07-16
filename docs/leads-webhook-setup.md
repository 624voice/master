# Lead webhook setup (email + Google Sheet)

Site lead forms POST to `LEADS_WEBHOOK_URL`. Point that env var at a Google Apps Script web app that appends each lead to a Sheet and emails **info@624voice.com**.

## 1. Create the Google Sheet

1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet (e.g. "624 Voice Leads").
2. Copy the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

## 2. Deploy the Apps Script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the default `Code.gs` contents and paste in [`scripts/leads-webhook.gs`](../scripts/leads-webhook.gs).
3. Set `SHEET_ID` at the top of the script to your spreadsheet ID.
4. Save the project (e.g. name it "624 Voice Lead Webhook").
5. Run **testLeadWebhook** once from the editor to authorize Gmail + Sheets access and confirm a test row/email.
6. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the **Web app URL** (ends in `/exec`).

## 3. Configure Netlify

In [Netlify](https://app.netlify.com) → site **624voice** → **Site configuration → Environment variables**:

| Variable | Value |
|----------|-------|
| `LEADS_WEBHOOK_URL` | Your Apps Script web app URL |

Redeploy production after saving.

## 4. Verify

1. Submit the **contact form** at `/contact`.
2. Unlock the **ROI calculator** breakdown or download a PDF.
3. Confirm each submission:
   - Adds a row to the Google Sheet
   - Sends email to info@624voice.com

## Lead sources

| `source` value | Form |
|----------------|------|
| `contact_form` | Contact page |
| `missing_money` | ROI calculator unlock |
| `missing_money_pdf` | ROI PDF download |

## Troubleshooting

- **Webhook failed with status 401/403:** Redeploy the web app with access set to **Anyone**.
- **No email:** Confirm Gmail authorization in Apps Script and that `LEADS_EMAIL` is correct.
- **LEADS_WEBHOOK_URL is not configured:** Set the Netlify env var and redeploy.
