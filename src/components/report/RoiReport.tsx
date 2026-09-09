import type { ReportViewModel } from "~/lib/report/types";
import { DriverIcon } from "~/components/report/ReportIcons";

type RoiReportProps = {
  model: ReportViewModel;
  logoSrc?: string;
};

function ReportHeader({ model, logoSrc }: RoiReportProps) {
  return (
    <header className="report-header">
      <div className="report-brand">
        {logoSrc ? <img src={logoSrc} alt="624 Voice" /> : null}
        <div className="report-brand-name">
          624 <span>Voice</span>
        </div>
      </div>
      <div className="report-meta">
        <div>Revenue Gap Report</div>
        <div>{model.metadata.reportDate}</div>
        <div>{model.metadata.reportId}</div>
      </div>
    </header>
  );
}

function ReportFooter({ model }: { model: ReportViewModel }) {
  return (
    <footer className="report-footer">
      <span>
        {model.metadata.footerEmail} · {model.metadata.footerSite}
      </span>
      <span>624 Voice</span>
    </footer>
  );
}

function ExecutivePage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <span className="report-badge">Personalized revenue model</span>
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          lineHeight: 1.25,
          margin: "10px 0 6px",
          maxWidth: "6.5in",
        }}
      >
        {model.prospect.businessName} may have significant modeled revenue
        slipping through operational gaps
      </h1>
      <p className="report-subtitle" style={{ marginBottom: 14 }}>
        {model.prospect.preparedForLine}
      </p>
      <div className="report-card-dark" style={{ padding: "18px 20px", marginTop: 8 }}>
        <div className="report-subtitle" style={{ color: "#94a3b8", marginBottom: 6 }}>
          Moderate modeled annual opportunity
        </div>
        <div className="report-hero-value">{model.moderateHeroTotalFormatted}</div>
        <div style={{ marginTop: 10, fontSize: 10, color: "#cbd5e1" }}>
          {model.operation.contextLine}
        </div>
      </div>
      <div className="report-scenario-grid">
        {model.scenarios.map((scenario, index) => (
          <div
            key={scenario.name}
            className={`report-card report-scenario-card${index === 1 ? " is-moderate" : ""}`}
          >
            <div className="report-scenario-name">{scenario.name}</div>
            <div className="report-scenario-total">{scenario.totalFormatted}</div>
            <div className="report-subtitle" style={{ marginTop: 4 }}>
              {scenario.captureRange} capture
            </div>
          </div>
        ))}
      </div>
      <div className="report-continue">Detailed breakdown on page 2 →</div>
      <ReportFooter model={model} />
    </section>
  );
}

function BreakdownPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <h2 className="report-section-title">Opportunity breakdown</h2>
      <p className="report-subtitle" style={{ marginBottom: 10 }}>
        Moderate scenario · five independent revenue drivers
      </p>
      <div className="report-card" style={{ padding: "8px 14px" }}>
        {model.drivers.map((driver) => (
          <div key={driver.key} className="report-driver-row">
            <DriverIcon driverKey={driver.key} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{driver.label}</div>
              <div className="report-subtitle">{driver.monthlyVolume}</div>
              <div className="report-driver-bar-wrap">
                <div
                  className="report-driver-bar"
                  style={{ width: `${Math.max(driver.barPercent * 100, 4)}%` }}
                />
              </div>
            </div>
            <div className="report-driver-annual">{driver.annualValueFormatted}</div>
          </div>
        ))}
        <div className="report-total-row">
          <span>Total modeled annual opportunity</span>
          <span>{model.moderateHeroTotalFormatted}</span>
        </div>
      </div>
      <div className="report-callout">
        <strong>{model.largestDriver.label}</strong> is the largest modeled driver at{" "}
        {model.largestDriver.annualValueFormatted} annually in the moderate scenario.
      </div>
      <p className="report-subtitle">{model.noDoubleCountingNotes[0]}</p>
      <ReportFooter model={model} />
    </section>
  );
}

function DiagnosticPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <h2 className="report-section-title">What&apos;s causing the gap</h2>
      <p className="report-subtitle" style={{ marginBottom: 12 }}>
        Trade-specific operational leaks for {model.operation.tradeLabel}
      </p>
      <div className="report-diagnostic-grid">
        {model.tradeContent.blocks.map((block) => (
          <article key={block.title} className="report-card report-diagnostic-block">
            <h3>{block.title}</h3>
            <p>
              <strong>Problem:</strong> {block.problem}
            </p>
            <p>
              <strong>Consequence:</strong> {block.consequence}
            </p>
            <p>
              <strong>624Voice response:</strong> {block.response}
            </p>
          </article>
        ))}
      </div>
      <ReportFooter model={model} />
    </section>
  );
}

function MethodologyPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <h2 className="report-section-title">Methodology &amp; next step</h2>
      <div className="report-assumption-grid">
        {model.scenarioAssumptions.map((assumption) => (
          <div key={assumption.name} className="report-card report-assumption-card">
            <strong>{assumption.name}</strong>
            <div>Recovered booking: {assumption.recoveredBookingRate}</div>
            <div>No-show reduction: {assumption.noShowReduction}</div>
            <div>Upsell rate: {assumption.upsellRate}</div>
            <div>Admin hours saved: {assumption.adminHoursSaved}</div>
            <div>Campaign jobs: {assumption.campaignJobsPerMonth}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 9.5, lineHeight: 1.5, margin: "12px 0 0", color: "#475569" }}>
        Figures use scenario modeling against your entered call volume, trade assumptions listed
        below, and independent driver pools with no double-counting. Actual results vary by market,
        execution, and configuration.
      </p>
      <ul style={{ fontSize: 9, lineHeight: 1.45, margin: "8px 0 0", paddingLeft: 16, color: "#64748b" }}>
        {model.tradeAssumptions.slice(0, 4).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="report-guarantee">
        <p>{model.guarantee.body}</p>
        <small>{model.guarantee.footnote}</small>
      </div>
      <div className="report-closing-strip">
        {model.scenarios.map((scenario) => (
          <div key={scenario.name} className="report-closing-item">
            <strong>{scenario.totalFormatted}</strong>
            {scenario.name}
          </div>
        ))}
      </div>
      <div className="report-card-dark report-cta">
        <h2>{model.cta.headline}</h2>
        <p>{model.cta.body}</p>
        <a href={model.cta.url}>Book your demo</a>
      </div>
      <ReportFooter model={model} />
    </section>
  );
}

export function RoiReport({ model, logoSrc = "/logo.png" }: RoiReportProps) {
  return (
    <div className="report-root">
      <ExecutivePage model={model} logoSrc={logoSrc} />
      <BreakdownPage model={model} logoSrc={logoSrc} />
      <DiagnosticPage model={model} logoSrc={logoSrc} />
      <MethodologyPage model={model} logoSrc={logoSrc} />
    </div>
  );
}
