import { CheckCircleIcon, ShieldIcon } from "~/components/report/ReportIcons";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { TRADES } from "~/lib/roi/roiModel";
import type { ReportViewModel } from "~/lib/report/types";
import {
  DRIVER_DISPLAY,
  DRIVER_DISPLAY_ORDER,
  GUARANTEE_CARD_TITLE,
  LEAK_ROW_COPY,
  MODEL_CARD_DISCLAIMER,
  MODEL_CARD_EYEBROW,
  MODEL_CARD_SUB,
  NO_DOUBLE_COUNTING_NOTE,
  PAGE1_HERO_HEADLINE,
  PAGE1_SUPPORTING_LINE,
  ROI_RECAP_BODY,
  ROI_RECAP_HEADLINE,
  SECTION_01_TITLE,
  SECTION_02_REALIZATION_BODY,
  SECTION_02_REALIZATION_CLOSE,
  SECTION_02_REALIZATION_LEAD,
  SECTION_02_TITLE,
  SECTION_03_TITLE,
  SECTION_04_TITLE,
  SECTION_05_TITLE,
  SECTION_06_TITLE,
  WHAT_WE_BUILD_COLUMNS,
  WHAT_WE_BUILD_EYEBROW,
  WHAT_WE_BUILD_FOOTNOTE,
  WHAT_WE_BUILD_LEAD,
  type DriverCopyKey,
} from "~/lib/report/reportCopy";

const TOTAL_PAGES = 4;

type RoiReportProps = {
  model: ReportViewModel;
  logoSrc?: string;
};

function ReportHeader({ model, logoSrc }: RoiReportProps) {
  return (
    <header className="report-header">
      <div className="report-brand">
        {logoSrc ? <img src={logoSrc} alt="" className="report-logo-subtle" /> : null}
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

function ReportFooter({ model, page }: { model: ReportViewModel; page: number }) {
  return (
    <footer className="report-footer">
      <span>
        {model.metadata.footerEmail} · {model.metadata.footerSite}
      </span>
      <span>
        {page} / {TOTAL_PAGES}
      </span>
    </footer>
  );
}

function SectionHeading({
  number,
  title,
  align = "left",
}: {
  number?: string;
  title: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`report-section-heading report-section-heading--${align}`}>
      {number ? <span className="report-section-num">{number}</span> : null}
      <div className="report-section-heading-text">
        <h2 className="report-section-title">{title}</h2>
      </div>
    </div>
  );
}

function ScenarioSlider({ model }: { model: ReportViewModel }) {
  const values = model.scenarios.map((s) => s.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const positions = values.map((v) => ((v - min) / range) * 100);

  const trackLeft = 56;
  const trackRight = 584;
  const trackWidth = trackRight - trackLeft;

  return (
    <div className="report-slider">
      <div className="report-slider-label">The range of what&apos;s recoverable</div>
      <svg className="report-slider-track" viewBox="0 0 640 80" aria-hidden="true">
        <line
          x1={trackLeft}
          y1="40"
          x2={trackRight}
          y2="40"
          stroke="#e2e8f0"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {model.scenarios.map((scenario, index) => {
          const x = trackLeft + (positions[index]! / 100) * trackWidth;
          const isModerate = index === 1;
          const isFirst = index === 0;
          const isLast = index === model.scenarios.length - 1;
          const labelAnchor = isFirst ? "start" : isLast ? "end" : "middle";
          const valueAnchor = labelAnchor;
          const labelX = isFirst ? trackLeft : isLast ? trackRight : x;
          const valueX = labelX;
          return (
            <g key={scenario.name}>
              <circle
                cx={x}
                cy="40"
                r={isModerate ? 9 : 7}
                fill={isModerate ? "#10b981" : "#ffffff"}
                stroke={isModerate ? "#059669" : "#94a3b8"}
                strokeWidth="2"
              />
              <text
                x={labelX}
                y="16"
                textAnchor={labelAnchor}
                fontSize="9"
                fontWeight={isModerate ? "700" : "600"}
                fill={isModerate ? "#059669" : "#64748b"}
              >
                {scenario.name}
              </text>
              <text
                x={valueX}
                y="64"
                textAnchor={valueAnchor}
                fontSize="11"
                fontWeight={isModerate ? "800" : "700"}
                fill={isModerate ? "#162736" : "#475569"}
              >
                {scenario.totalFormatted}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getDriverByKey(model: ReportViewModel, key: DriverCopyKey) {
  return model.drivers.find((d) => d.key === key)!;
}

function CompactDriverRow({
  model,
  driverKey,
}: {
  model: ReportViewModel;
  driverKey: DriverCopyKey;
}) {
  const driver = getDriverByKey(model, driverKey);
  const copy = DRIVER_DISPLAY[driverKey];
  return (
    <div className="report-driver-compact">
      <span className="report-driver-compact-headline">{copy.headline}</span>
      <span className="report-driver-compact-mechanism">{copy.shortMechanism}</span>
      <div className="report-driver-bar-wrap report-driver-bar-wrap--inline">
        <div
          className="report-driver-bar"
          style={{ width: `${Math.max(driver.barPercent * 100, 4)}%` }}
        />
      </div>
      <span className="report-driver-compact-value">{driver.annualValueFormatted}</span>
    </div>
  );
}

function ModelInputsCard({ model }: { model: ReportViewModel }) {
  const trade = TRADES[model.operation.trade];
  const fmtPct = (rate: number) => `${Math.round(rate * 1000) / 10}%`.replace(/\.0%$/, "%");
  const fmtMoney = (n: number) =>
    formatCurrency(n).replace(/\.00$/, "");

  return (
    <div className="report-card report-model-card">
      <div className="report-model-card-header">
        <div className="report-model-card-eyebrow">{MODEL_CARD_EYEBROW}</div>
        <div className="report-model-card-sub">{MODEL_CARD_SUB}</div>
      </div>
      <div className="report-model-grid">
        <div className="report-model-col">
          <div className="report-model-col-title">YOUR BUSINESS</div>
          <div className="report-model-row">
            <strong>{model.operation.truckCount}</strong> Trucks
          </div>
          <div className="report-model-row">
            <strong>{model.operation.monthlyCalls.toLocaleString("en-US")}</strong> Calls / month
          </div>
          <div className="report-model-row">
            <strong>{model.operation.tradeLabel}</strong> Trade
          </div>
        </div>
        <div className="report-model-col">
          <div className="report-model-col-title">TRADE BENCHMARKS</div>
          <div className="report-model-row">
            <strong>{fmtMoney(trade.avgJobValue)}</strong> Average job
          </div>
          <div className="report-model-row">
            <strong>{fmtPct(trade.missedCallRate)}</strong> Missed call rate
          </div>
          <div className="report-model-row">
            <strong>{fmtPct(trade.noShowRate)}</strong> No-show rate
          </div>
          <div className="report-model-row">
            <strong>{fmtPct(trade.baseBookingConv)}</strong> Booking conversion
          </div>
          <div className="report-model-row">
            <strong>{fmtMoney(trade.avgUpsellValue)}</strong> Average upsell
          </div>
        </div>
      </div>
      <p className="report-model-no-double">
        <strong>No double-counting.</strong> Each opportunity is modeled against a separate revenue
        pool.
      </p>
      <p className="report-model-disclaimer">{MODEL_CARD_DISCLAIMER}</p>
    </div>
  );
}

function OpportunityPage({ model, logoSrc }: RoiReportProps) {
  const financialLine = `Based on your numbers, roughly ${model.moderateHeroTotalFormatted} a year may be recoverable.`;

  return (
    <section className="report-page report-page--opportunity">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <div className="report-p1-editorial">
          <span className="report-badge">PERSONALIZED ANALYSIS</span>
          <h1 className="report-hero-headline">{PAGE1_HERO_HEADLINE}</h1>
          <p className="report-lead">{PAGE1_SUPPORTING_LINE}</p>
          {model.prospect.preparedForLine ? (
            <p className="report-personalization">{model.prospect.preparedForLine}</p>
          ) : null}
          <p className="report-financial-line">{financialLine}</p>
          <div className="report-card-dark report-hero-card report-hero-card--inline">
            <div className="report-hero-label">Moderate modeled annual opportunity</div>
            <div className="report-hero-value">{model.moderateHeroTotalFormatted}</div>
            <div className="report-hero-context">{model.operation.contextLine}</div>
          </div>
        </div>
        <div className="report-p1-range">
          <ScenarioSlider model={model} />
        </div>
        <div className="report-p1-breakdown">
          <SectionHeading number="01" title={SECTION_01_TITLE} align="left" />
          <div className="report-driver-compact-list">
            {DRIVER_DISPLAY_ORDER.map((key) => (
              <CompactDriverRow key={key} model={model} driverKey={key} />
            ))}
          </div>
          <p className="report-p1-total">
            <strong>{model.moderateHeroTotalFormatted}</strong> total modeled annual opportunity
          </p>
          <p className="report-note">{NO_DOUBLE_COUNTING_NOTE}</p>
        </div>
      </div>
      <ReportFooter model={model} page={1} />
    </section>
  );
}

function ProblemPage({ model, logoSrc }: RoiReportProps) {
  const closeLine = SECTION_02_REALIZATION_CLOSE.replace(
    "{moderateTotal}",
    model.moderateHeroTotalFormatted,
  );

  return (
    <section className="report-page report-page--problem">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <SectionHeading number="02" title={SECTION_02_TITLE} align="center" />
        <div className="report-realization">
          <p className="report-realization-lead">
            <strong>{SECTION_02_REALIZATION_LEAD}</strong>
          </p>
          <p className="report-realization-body">{SECTION_02_REALIZATION_BODY}</p>
          <p className="report-realization-close">
            <strong>{closeLine}</strong>
          </p>
        </div>
        <SectionHeading number="03" title={SECTION_03_TITLE} align="left" />
        <div className="report-leak-compact-list">
          {DRIVER_DISPLAY_ORDER.map((driverKey) => {
            const driver = getDriverByKey(model, driverKey);
            const label = DRIVER_DISPLAY[driverKey].headline;
            const copy = LEAK_ROW_COPY[driverKey];
            return (
              <div key={driverKey} className="report-leak-compact">
                <div className="report-leak-compact-header">
                  <span className="report-leak-compact-name">{label}</span>
                  <span className="report-leak-compact-value">{driver.annualValueFormatted}</span>
                </div>
                <p className="report-leak-compact-consequence">{copy.consequence}</p>
                <p className="report-leak-compact-response">
                  <strong>624Voice:</strong> {copy.response}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <ReportFooter model={model} page={2} />
    </section>
  );
}

function ProofPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page report-page--proof">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <SectionHeading number="04" title={SECTION_04_TITLE} align="center" />
        <div className="report-scenario-detail-grid">
          {model.scenarioAssumptions.map((assumption, index) => (
            <div
              key={assumption.name}
              className={`report-card report-scenario-detail${index === 1 ? " is-moderate" : ""}`}
            >
              <div className="report-scenario-detail-name">{assumption.name}</div>
              <div className="report-scenario-detail-total">
                {model.scenarios[index]!.totalFormatted}
              </div>
              <div className="report-scenario-detail-lines">
                <div>Recovered booking: {assumption.recoveredBookingRate}</div>
                <div>No-show reduction: {assumption.noShowReduction}</div>
                <div>Upsell rate: {assumption.upsellRate}</div>
                <div>Admin hours saved: {assumption.adminHoursSaved}</div>
                <div>Campaign jobs: {assumption.campaignJobsPerMonth}</div>
              </div>
            </div>
          ))}
        </div>
        <ModelInputsCard model={model} />
        <SectionHeading number="05" title={SECTION_05_TITLE} align="center" />
        <div className="report-guarantee">
          <ShieldIcon className="report-guarantee-icon" />
          <h3 className="report-guarantee-title">{GUARANTEE_CARD_TITLE}</h3>
          <p>{model.guarantee.body}</p>
          <small>{model.guarantee.footnote}</small>
        </div>
      </div>
      <ReportFooter model={model} page={3} />
    </section>
  );
}

function ActionPage({ model, logoSrc }: RoiReportProps) {
  const recapHeadline = ROI_RECAP_HEADLINE.replace(
    "{conservativeTotal}",
    model.scenarios[0]!.totalFormatted,
  );

  return (
    <section className="report-page report-page--action">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <div className="report-closing-stack">
          <div className="report-recap-band">
            <p className="report-recap-headline">{recapHeadline}</p>
            <p className="report-recap-body">{ROI_RECAP_BODY}</p>
            <div className="report-closing-strip">
              {model.scenarios.map((scenario) => (
                <div key={scenario.name} className="report-closing-item">
                  <strong>{scenario.totalFormatted}</strong>
                  {scenario.name}
                </div>
              ))}
            </div>
          </div>
          <SectionHeading number="06" title={SECTION_06_TITLE} align="center" />
          <div className="report-card-dark report-cta">
            {logoSrc ? <img src={logoSrc} alt="" className="report-cta-logo" /> : null}
            <h2>{model.cta.headline}</h2>
            <p>{model.cta.body}</p>
            <ul className="report-cta-highlights">
              {model.cta.highlights.map((line) => (
                <li key={line}>
                  <CheckCircleIcon className="report-cta-check" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <a href={model.cta.url} className="report-cta-button">
              {model.cta.buttonLabel}
            </a>
            <p className="report-cta-fine">{model.cta.finePrint}</p>
          </div>
          <div className="report-card report-what-we-build">
            <div className="report-what-we-build-eyebrow">{WHAT_WE_BUILD_EYEBROW}</div>
            <p className="report-what-we-build-lead">{WHAT_WE_BUILD_LEAD}</p>
            <div className="report-what-we-build-grid">
              {WHAT_WE_BUILD_COLUMNS.map((col) => (
                <div key={col.label} className="report-what-we-build-col">
                  <div className="report-what-we-build-col-title">{col.label}</div>
                  <ul>
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="report-what-we-build-foot">{WHAT_WE_BUILD_FOOTNOTE}</p>
          </div>
        </div>
      </div>
      <ReportFooter model={model} page={4} />
    </section>
  );
}

export function RoiReport({ model, logoSrc = "/logo.png" }: RoiReportProps) {
  return (
    <div className="report-root">
      <OpportunityPage model={model} logoSrc={logoSrc} />
      <ProblemPage model={model} logoSrc={logoSrc} />
      <ProofPage model={model} logoSrc={logoSrc} />
      <ActionPage model={model} logoSrc={logoSrc} />
    </div>
  );
}
