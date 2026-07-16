/**
 * 624 Voice lead webhook — Google Apps Script
 *
 * Receives POST JSON from the site (LEADS_WEBHOOK_URL) and:
 * 1. Appends a row to your Google Sheet
 * 2. Emails info@624voice.com
 *
 * Sheet columns (row 1 headers) must match the contact intake form:
 * Timestamp | First Name | Last Name | Business Name | Trade | Website | Email | Phone | Fleet Size | Message
 *
 * Setup: see docs/leads-webhook-setup.md
 */

const SHEET_ID = "1h2LdwHJarHTS-06MJJ0RhZDZjFiac9sazcKb3JtGyuw";
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

function splitName(data) {
  if (data.firstName || data.lastName) {
    return {
      firstName: data.firstName || "",
      lastName: data.lastName || "",
    };
  }
  const parts = (data.name || "").trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] || "", lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function appendLeadRow(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const { firstName, lastName } = splitName(data);

  sheet.appendRow([
    data.capturedAt || new Date().toISOString(),
    firstName,
    lastName,
    data.businessName || "",
    data.trade || "",
    data.website || "",
    data.email || "",
    data.phone || "",
    data.fleetSize || "",
    data.message || "",
  ]);
}

function sendLeadEmail(data) {
  const { firstName, lastName } = splitName(data);
  const subject = `New lead: ${firstName} ${lastName}`.trim() + ` (${data.source || "website"})`;
  const body = [
    "New lead from 624voice.com",
    "",
    `Source: ${data.source || ""}`,
    `First name: ${firstName}`,
    `Last name: ${lastName}`,
    `Business: ${data.businessName || ""}`,
    `Trade: ${data.trade || ""}`,
    `Website: ${data.website || ""}`,
    `Email: ${data.email || ""}`,
    `Phone: ${data.phone || ""}`,
    `Fleet size: ${data.fleetSize || ""}`,
    `Message: ${data.message || ""}`,
    `Monthly calls: ${data.monthlyCalls ?? ""}`,
    `Truck count: ${data.truckCount ?? ""}`,
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
    source: "contact_form",
    firstName: "Test",
    lastName: "User",
    businessName: "Test Plumbing LLC",
    email: "test@example.com",
    phone: "(555) 123-4567",
    trade: "Plumbing",
    website: "https://example.com",
    fleetSize: "3-7",
    message: "Setup test from Apps Script",
  };
  appendLeadRow(sample);
  sendLeadEmail(sample);
}
