import {
  CalendarCheckIcon,
  CapturePillarIcon,
  CheckCircleIcon,
  ConversionIcon,
  ConvertPillarIcon,
  DollarIcon,
  DriverIcon,
  PhoneIcon,
  PhoneMissedIcon,
  RecoverPillarIcon,
  RevenueIcon,
  ShieldIcon,
  TradeIcon,
  TrendUpIcon,
  TruckIcon,
  ModelInputIcon,
} from "~/components/report/ReportIcons";
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
  ORCHESTRATION_COLUMNS,
  ORCHESTRATION_FOOTNOTE,
  ORCHESTRATION_TITLE,
  PAGE1_HERO_HEADLINE,
  PAGE1_SUPPORTING_LINE,
  RECAP_SCENARIO_SUB,
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
  type DriverCopyKey,
} from "~/lib/report/reportCopy";

const TOTAL_PAGES = 4;

const PILLAR_ICONS = {
  CAPTURE: CapturePillarIcon,
  CONVERT: ConvertPillarIcon,
  RECOVER: RecoverPillarIcon,
} as const;

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
          const labelX = isFirst ? trackLeft : isLast ? trackRight : x;
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
                x={labelX}
                y="64"
                textAnchor={labelAnchor}
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
  const fmtMoney = (n: number) => formatCurrency(n).replace(/\.00$/, "");

  return (
    <div className="report-card report-model-card">
      <div className="report-model-card-header">
        <div className="report-model-card-eyebrow">{MODEL_CARD_EYEBROW}</div>
        <div className="report-model-card-sub">{MODEL_CARD_SUB}</div>
      </div>
      <div className="report-model-grid">
        <div className="report-model-col">
          <div className="report-model-col-title">YOUR BUSINESS</div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <TruckIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{model.operation.truckCount}</strong> Trucks
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <PhoneIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{model.operation.monthlyCalls.toLocaleString("en-US")}</strong> Calls / month
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <TradeIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{model.operation.tradeLabel}</strong> Trade
            </span>
          </div>
        </div>
        <div className="report-model-col">
          <div className="report-model-col-title">TRADE BENCHMARKS</div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <DollarIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{fmtMoney(trade.avgJobValue)}</strong> Average job
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <PhoneMissedIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{fmtPct(trade.missedCallRate)}</strong> Missed call rate
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <CalendarCheckIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{fmtPct(trade.noShowRate)}</strong> No-show rate
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <ConversionIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{fmtPct(trade.baseBookingConv)}</strong> Booking conversion
            </span>
          </div>
          <div className="report-model-row report-model-row--icon">
            <ModelInputIcon>
              <TrendUpIcon className="report-icon-svg report-icon-svg--sm" />
            </ModelInputIcon>
            <span>
              <strong>{fmtMoney(trade.avgUpsellValue)}</strong> Average upsell
            </span>
          </div>
        </div>
      </div>
      <div className="report-model-strip">
        <strong>No double-counting.</strong> Each opportunity is modeled against a separate revenue
        pool.
      </div>
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
        <div className="report-p1-top">
          <span className="report-badge">PERSONALIZED ANALYSIS</span>
          <h1 className="report-hero-headline">{PAGE1_HERO_HEADLINE}</h1>
          <p className="report-lead">{PAGE1_SUPPORTING_LINE}</p>
          {model.prospect.preparedForLine ? (
            <p className="report-personalization">{model.prospect.preparedForLine}</p>
          ) : null}
        </div>
        <div className="report-p1-middle">
          <p className="report-financial-line report-financial-line--center">{financialLine}</p>
          <div className="report-card-dark report-hero-card report-hero-card--billboard">
            <RevenueIcon className="report-hero-card-icon" />
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
        <div className="report-p2-top">
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
        </div>
        <div className="report-p2-diagnostic">
          <SectionHeading number="03" title={SECTION_03_TITLE} align="left" />
          <div className="report-leak-card-list">
            {DRIVER_DISPLAY_ORDER.map((driverKey) => {
              const driver = getDriverByKey(model, driverKey);
              const label = DRIVER_DISPLAY[driverKey].headline;
              const copy = LEAK_ROW_COPY[driverKey];
              return (
                <div key={driverKey} className="report-leak-card">
                  <DriverIcon driverKey={driverKey} />
                  <div className="report-leak-card-body">
                    <div className="report-leak-card-name">{label}</div>
                    <p className="report-leak-card-consequence">{copy.consequence}</p>
                    <p className="report-leak-card-response">
                      <strong>624Voice:</strong> {copy.response}
                    </p>
                  </div>
                  <div className="report-leak-card-value">{driver.annualValueFormatted}</div>
                </div>
              );
            })}
          </div>
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
        <div className="report-p3-guarantee-block">
          <SectionHeading number="05" title={SECTION_05_TITLE} align="center" />
          <div className="report-guarantee">
            <ShieldIcon className="report-guarantee-icon" />
            <h3 className="report-guarantee-title">{GUARANTEE_CARD_TITLE}</h3>
            <p>{model.guarantee.body}</p>
            <small>{model.guarantee.footnote}</small>
          </div>
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
          <div className="report-recap-intro">
            <p className="report-recap-headline">{recapHeadline}</p>
            <p className="report-recap-body">{ROI_RECAP_BODY}</p>
          </div>
          <div className="report-recap-scenarios">
            {model.scenarios.map((scenario, index) => (
              <div
                key={scenario.name}
                className={`report-card report-recap-scenario${index === 1 ? " is-moderate" : ""}`}
              >
                <div className="report-recap-scenario-name">{scenario.name}</div>
                <div className="report-recap-scenario-total">{scenario.totalFormatted}</div>
                <div className="report-recap-scenario-sub">{RECAP_SCENARIO_SUB}</div>
              </div>
            ))}
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
          <div className="report-card report-orchestration">
            {logoSrc ? <img src={logoSrc} alt="" className="report-orchestration-logo" /> : null}
            <h3 className="report-orchestration-title">{ORCHESTRATION_TITLE}</h3>
            <div className="report-orchestration-grid">
              {ORCHESTRATION_COLUMNS.map((col) => {
                const PillarIcon = PILLAR_ICONS[col.label];
                return (
                  <div key={col.label} className="report-orchestration-col">
                    <div className="report-orchestration-col-head">
                      <ModelInputIcon>
                        <PillarIcon className="report-icon-svg report-icon-svg--sm" />
                      </ModelInputIcon>
                      <span>{col.label}</span>
                    </div>
                    <ul>
                      {col.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="report-orchestration-foot">
              <strong>{ORCHESTRATION_FOOTNOTE}</strong>
            </p>
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
