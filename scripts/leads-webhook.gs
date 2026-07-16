/**
 * 624 Voice lead webhook — Google Apps Script
 *
 * Receives POST JSON from the site (LEADS_WEBHOOK_URL) and:
 * 1. Appends a row to your Google Sheet
 * 2. Emails info@624voice.com
 *
 * Setup: see docs/leads-webhook-setup.md
 */

const SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const LEADS_EMAIL = "info@624voice.com";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    appendLeadRow(payload);
    sendLeadEmail(payload);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function appendLeadRow(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Source",
      "Name",
      "Business",
      "Email",
      "Phone",
      "Trade",
      "Website",
      "Monthly Calls",
      "Truck Count",
      "Fleet Size",
      "Message",
    ]);
  }
  sheet.appendRow([
    data.capturedAt || new Date().toISOString(),
    data.source || "",
    data.name || "",
    data.businessName || "",
    data.email || "",
    data.phone || "",
    data.trade || "",
    data.website || "",
    data.monthlyCalls ?? "",
    data.truckCount ?? "",
    data.fleetSize || "",
    data.message || "",
  ]);
}

function sendLeadEmail(data) {
  const subject = `New lead: ${data.name || "Unknown"} (${data.source || "website"})`;
  const body = [
    "New lead from 624voice.com",
    "",
    `Source: ${data.source || ""}`,
    `Name: ${data.name || ""}`,
    `Business: ${data.businessName || ""}`,
    `Email: ${data.email || ""}`,
    `Phone: ${data.phone || ""}`,
    `Trade: ${data.trade || ""}`,
    `Website: ${data.website || ""}`,
    `Monthly calls: ${data.monthlyCalls ?? ""}`,
    `Truck count: ${data.truckCount ?? ""}`,
    `Fleet size: ${data.fleetSize || ""}`,
    `Message: ${data.message || ""}`,
    "",
    `Captured at: ${data.capturedAt || new Date().toISOString()}`,
  ].join("\n");

  GmailApp.sendEmail(LEADS_EMAIL, subject, body, {
    replyTo: data.email || undefined,
  });
}

function testLeadWebhook() {
  const sample = {
    capturedAt: new Date().toISOString(),
    source: "test",
    name: "Test User",
    businessName: "Test Plumbing LLC",
    email: "test@example.com",
    phone: "(555) 123-4567",
    trade: "Plumbing",
    website: "https://example.com",
    monthlyCalls: 300,
    truckCount: 5,
    fleetSize: "3-7",
    message: "Setup test from Apps Script",
  };
  appendLeadRow(sample);
  sendLeadEmail(sample);
}
