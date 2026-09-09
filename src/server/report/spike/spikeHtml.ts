/** Trivial multi-page HTML for Phase 0 renderer feasibility spike only. */
export function buildSpikeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>624Voice PDF Spike</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    body { font-family: system-ui, sans-serif; margin: 0; color: #162736; }
    .page { page-break-after: always; min-height: 9in; padding: 0.25in 0; }
    .page:last-child { page-break-after: auto; }
    h1 { color: #10b981; font-size: 28px; margin: 0 0 12px; }
    h2 { font-size: 18px; margin: 24px 0 8px; }
    p { line-height: 1.5; margin: 0 0 10px; }
    .badge { display: inline-block; background: #d1fae5; color: #059669; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
  </style>
</head>
<body>
  <section class="page">
    <span class="badge">Phase 0 spike</span>
    <h1>624Voice PDF Renderer Feasibility</h1>
    <p>Page 1 — executive snapshot placeholder.</p>
    <p>This document validates puppeteer-core + Sparticuz Chromium on Netlify.</p>
  </section>
  <section class="page">
    <h2>Page 2 — Opportunity breakdown</h2>
    <p>Five driver rows would appear here in production.</p>
    <ul>
      <li>Missed-call recovery</li>
      <li>No-show reduction</li>
      <li>Outbound SMS</li>
      <li>Job-closer upsells</li>
      <li>Time savings</li>
    </ul>
  </section>
  <section class="page">
    <h2>Page 3 — Diagnostic blocks</h2>
    <p>Trade-specific narrative would render here.</p>
  </section>
  <section class="page">
    <h2>Page 4 — Methodology &amp; CTA</h2>
    <p>Scenario assumptions and booking link would render here.</p>
    <p><a href="https://calendar.app.google/hpzTSkjb9NTqaMjh9">Book demo</a></p>
  </section>
</body>
</html>`;
}
