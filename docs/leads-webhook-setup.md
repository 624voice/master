# Lead webhook setup (email + Google Sheet)

Site lead forms POST to `LEADS_WEBHOOK_URL`. Point that env var at a Google Apps Script web app that appends each lead to a Sheet and emails **info@624voice.com**.

**Your leads sheet:** [624 Voice Leads](https://docs.google.com/spreadsheets/d/1h2LdwHJarHTS-06MJJ0RhZDZjFiac9sazcKb3JtGyuw/edit)

Row 1 headers should match the contact intake form:

`Timestamp | First Name | Last Name | Business Name | Trade | Website | Email | Phone | Fleet Size | Monthly Calls | Truck Count | Message`

Timestamps are stored in **Central Time (America/Chicago)**, e.g. `2026-07-16 1:57:07 PM CT`.

ROI calculator leads populate **Fleet Size**, **Monthly Calls**, and **Truck Count** from the calculator (exact truck count and call volume). Contact form leads leave **Monthly Calls** and **Truck Count** blank and use a fleet-size range for **Fleet Size**.

## 1. Deploy the Apps Script

1. Open your [leads spreadsheet](https://docs.google.com/spreadsheets/d/1h2LdwHJarHTS-06MJJ0RhZDZjFiac9sazcKb3JtGyuw/edit).
2. **Extensions → Apps Script**.
3. Delete the default `Code.gs` contents and paste in [`scripts/leads-webhook.gs`](../scripts/leads-webhook.gs). The Sheet ID is already set.
4. Save the project (e.g. name it "624 Voice Lead Webhook").
5. Run **testLeadWebhook** once from the editor to authorize Gmail + Sheets access and confirm a test row/email.
6. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the **Web app URL** (ends in `/exec`).

## 2. Configure Netlify

In [Netlify](https://app.netlify.com) → site **624voice** → **Site configuration → Environment variables**:

| Variable | Value |
|----------|-------|
| `LEADS_WEBHOOK_URL` | Your Apps Script web app URL |

Redeploy production after saving.

## 3. Verify

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
