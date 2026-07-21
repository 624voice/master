/**
 * 624 Voice lead webhook — Google Apps Script
 *
 * Receives POST JSON from the site (LEADS_WEBHOOK_URL) and:
 * 1. Appends lead rows to the main sheet + emails info@624voice.com
 * 2. Appends Speed2Lead SMS transcript rows to the "SMS Transcripts" tab
 *
 * Lead sheet columns (row 1 headers):
 * Timestamp | First Name | Last Name | Business Name | Trade | Website | Email | Phone | Fleet Size | Monthly Calls | Truck Count | Message | Moderate ROI | Source | SMS Consent
 *
 * SMS Transcripts columns (row 1 headers):
 * Timestamp | Flow | Direction | Phone | First Name | Business Name | Conversation State | Need Summary | Message
 *
 * Setup: see docs/leads-webhook-setup.md
 */

const SHEET_ID = "1h2LdwHJarHTS-06MJJ0RhZDZjFiac9sazcKb3JtGyuw";
const LEADS_EMAIL = "info@624voice.com";
const TIME_ZONE = "America/Chicago";
const SMS_TRANSCRIPT_SHEET_NAME = "SMS Transcripts";

const HEADERS = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Business Name",
  "Trade",
  "Website",
  "Email",
  "Phone",
  "Fleet Size",
  "Monthly Calls",
  "Truck Count",
  "Message",
  "Moderate ROI",
  "Source",
  "SMS Consent",
];

const SMS_TRANSCRIPT_HEADERS = [
  "Timestamp",
  "Flow",
  "Direction",
  "Phone",
  "First Name",
  "Business Name",
  "Conversation State",
  "Need Summary",
  "Message",
];

/** Format as Central Time, e.g. "2026-07-16 1:57:07 PM CT" */
function formatCentralTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) {
    return String(value || "");
  }
  return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd h:mm:ss a") + " CT";
}

function getLeadSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const existing = headerRange.getValues()[0];
  const needsUpdate = HEADERS.some(function (header, index) {
    return String(existing[index] || "").trim() !== header;
  });

  if (needsUpdate) {
    headerRange.setValues([HEADERS]);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.type === "sms_transcript") {
      appendSmsTranscriptRow(payload);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, type: "sms_transcript" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

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

function formatSmsConsent(value) {
  if (value === true || String(value).toLowerCase() === "true") {
    return "Yes";
  }
  if (value === false || String(value).toLowerCase() === "false") {
    return "No";
  }
  return "";
}

function formatLeadSource(source) {
  switch (source) {
    case "contact_form":
      return "Contact Form";
    case "missing_money":
      return "ROI Calculator";
    case "missing_money_pdf":
      return "ROI PDF";
    default:
      return String(source || "");
  }
}

function formatTranscriptFlow(flow) {
  if (flow === "contact") {
    return "Contact";
  }
  if (flow === "roi") {
    return "ROI";
  }
  return String(flow || "");
}

function appendLeadRow(data) {
  const sheet = getLeadSheet();
  ensureHeaders(sheet);
  const { firstName, lastName } = splitName(data);

  sheet.appendRow([
    formatCentralTimestamp(data.capturedAt),
    firstName,
    lastName,
    data.businessName || "",
    data.trade || "",
    data.website || "",
    data.email || "",
    data.phone || "",
    data.fleetSize || "",
    data.monthlyCalls ?? "",
    data.truckCount ?? "",
    data.message || "",
    data.moderateRoi || "",
    formatLeadSource(data.source),
    formatSmsConsent(data.smsConsent),
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
    `Moderate ROI: ${data.moderateRoi || ""}`,
    `SMS consent: ${formatSmsConsent(data.smsConsent)}`,
    "",
    `Captured at: ${formatCentralTimestamp(data.capturedAt)}`,
  ].join("\n");

  GmailApp.sendEmail(LEADS_EMAIL, subject, body, {
    replyTo: data.email || undefined,
  });
}

/** Run once from the Apps Script editor to add/update sheet headers. */
function setupSheetHeaders() {
  ensureHeaders(getLeadSheet());
  ensureSmsTranscriptHeaders(getSmsTranscriptSheet());
}

function getSmsTranscriptSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const existing = spreadsheet.getSheetByName(SMS_TRANSCRIPT_SHEET_NAME);
  if (existing) {
    return existing;
  }

  return spreadsheet.insertSheet(SMS_TRANSCRIPT_SHEET_NAME);
}

function ensureSmsTranscriptHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, SMS_TRANSCRIPT_HEADERS.length);
  const existing = headerRange.getValues()[0];
  const needsUpdate = SMS_TRANSCRIPT_HEADERS.some(function (header, index) {
    return String(existing[index] || "").trim() !== header;
  });

  if (needsUpdate) {
    headerRange.setValues([SMS_TRANSCRIPT_HEADERS]);
  }
}

function formatDirection(direction) {
  if (direction === "inbound") {
    return "Inbound";
  }
  if (direction === "outbound") {
    return "Outbound";
  }
  return String(direction || "");
}

function appendSmsTranscriptRow(data) {
  const sheet = getSmsTranscriptSheet();
  ensureSmsTranscriptHeaders(sheet);

  sheet.appendRow([
    formatCentralTimestamp(data.capturedAt),
    formatTranscriptFlow(data.flow),
    formatDirection(data.direction),
    data.phone || "",
    data.firstName || "",
    data.businessName || "",
    data.conversationState || "",
    data.shortNeedSummary || "",
    data.body || "",
  ]);
}

function testSmsTranscriptWebhook() {
  appendSmsTranscriptRow({
    capturedAt: new Date().toISOString(),
    flow: "contact",
    direction: "outbound",
    phone: "+15551234567",
    firstName: "Test",
    businessName: "Test Plumbing LLC",
    conversationState: "awaiting_contact_goal",
    shortNeedSummary: "better call handling",
    body: "Hey Test, Chris with 624Voice. This is a contact transcript test.",
  });
  appendSmsTranscriptRow({
    capturedAt: new Date().toISOString(),
    flow: "roi",
    direction: "inbound",
    phone: "+15551234567",
    firstName: "Test",
    businessName: "Test Plumbing LLC",
    conversationState: "awaiting_goal",
    body: "Both",
  });
}

function testLeadWebhook() {
  const sample = {
    capturedAt: new Date().toISOString(),
    source: "missing_money",
    firstName: "Test",
    lastName: "User",
    businessName: "Test Plumbing LLC",
    email: "test@example.com",
    phone: "(555) 123-4567",
    trade: "Plumbing",
    website: "https://example.com",
    fleetSize: "10",
    monthlyCalls: 600,
    truckCount: 10,
    moderateRoi: "$324,123",
    message: "Setup test from Apps Script",
  };
  appendLeadRow(sample);
  sendLeadEmail(sample);
}
