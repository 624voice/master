import {
  CapturePillarIcon,
  CheckCircleIcon,
  ConvertPillarIcon,
  DriverIcon,
  RecoverPillarIcon,
  ShieldIcon,
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
  MODEL_CARD_NO_DOUBLE,
  ORCHESTRATION_COLUMNS,
  ORCHESTRATION_FOOTNOTE,
  ORCHESTRATION_TITLE,
  PAGE1_HERO_HEADLINE,
  PAGE1_SUPPORTING_LINE,
  SECTION_01_TITLE,
  SECTION_02_NARRATIVE,
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

const BLOCK_DRIVER_KEYS: DriverCopyKey[] = [
  "missedCallRecovery",
  "noShowReduction",
  "jobCloserUpsells",
  "outboundSms",
  "timeSavings",
];

type RoiReportProps = {
  model: ReportViewModel;
  logoSrc?: string;
};

function ReportHeader({ model, logoSrc }: RoiReportProps) {
  return (
    <header className="report-header">
      <div className="report-brand">
        {logoSrc ? <img src={logoSrc} alt="" className="report-logo-header" /> : null}
        <div className="report-brand-name">
          624 <span>Voice</span>
        </div>
      </div>
      <div className="report-meta">
        <div className="report-meta-title">Revenue Gap Report</div>
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
      <h2 className="report-section-title">{title}</h2>
    </div>
  );
}

function ScenarioRangeSlider({ model }: { model: ReportViewModel }) {
  return (
    <div className="report-range">
      <p className="report-range-label">The range of what&apos;s recoverable</p>
      <div className="report-range-inner">
        <div className="report-range-scenario-labels">
          <span>{model.scenarios[0]!.name}</span>
          <span className="is-moderate">{model.scenarios[1]!.name}</span>
          <span>{model.scenarios[2]!.name}</span>
        </div>
        <div className="report-range-track">
          <div className="report-range-fill" />
          <div className="report-range-dot report-range-dot--start" />
          <div className="report-range-dot report-range-dot--moderate" />
          <div className="report-range-dot report-range-dot--end" />
        </div>
        <div className="report-range-values">
          {model.scenarios.map((scenario, index) => (
            <span
              key={scenario.name}
              className={index === 1 ? "is-moderate" : undefined}
            >
              {scenario.totalFormatted}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDriverByKey(model: ReportViewModel, key: DriverCopyKey) {
  return model.drivers.find((d) => d.key === key)!;
}

function DriverRow({
  model,
  driverKey,
}: {
  model: ReportViewModel;
  driverKey: DriverCopyKey;
}) {
  const driver = getDriverByKey(model, driverKey);
  const copy = DRIVER_DISPLAY[driverKey];
  const leak = LEAK_ROW_COPY[driverKey];

  return (
    <div className="report-driver-row">
      <DriverIcon driverKey={driverKey} tone="inverse" />
      <div className="report-driver-row-body">
        <div className="report-driver-row-title">{copy.headline}</div>
        <div className="report-driver-row-sub">{leak.consequence}</div>
      </div>
      <div className="report-driver-row-value">{driver.annualValueFormatted}</div>
    </div>
  );
}

function TradeDiagnosticBlock({
  title,
  problem,
  consequence,
  response,
  driverKey,
}: {
  title: string;
  problem: string;
  consequence: string;
  response: string;
  driverKey: DriverCopyKey;
}) {
  return (
    <div className="report-trade-block">
      <div className="report-trade-block-head">
        <DriverIcon driverKey={driverKey} size="sm" tone="inverse" />
        <span>{title}</span>
      </div>
      <p className="report-trade-block-problem">
        {problem} {consequence}
      </p>
      <p className="report-trade-block-response">{response}</p>
    </div>
  );
}

function ModelInputsCard({ model }: { model: ReportViewModel }) {
  const trade = TRADES[model.operation.trade];
  const fmtPct = (rate: number) => `${Math.round(rate * 1000) / 10}%`.replace(/\.0%$/, "%");
  const fmtMoney = (n: number) => formatCurrency(n).replace(/\.00$/, "");

  const cells = [
    { value: String(model.operation.truckCount), label: "Trucks" },
    {
      value: model.operation.monthlyCalls.toLocaleString("en-US"),
      label: "Calls / month",
    },
    { value: fmtMoney(trade.avgJobValue), label: "Avg job value" },
    { value: fmtPct(trade.missedCallRate), label: "Missed call rate" },
    { value: model.operation.tradeLabel, label: "Trade" },
    { value: fmtPct(trade.noShowRate), label: "No-show rate" },
    { value: fmtPct(trade.baseBookingConv), label: "Booking conversion" },
    { value: fmtMoney(trade.avgUpsellValue), label: "Avg upsell" },
  ];

  return (
    <div className="report-card report-model-card">
      <div className="report-model-card-eyebrow">{MODEL_CARD_EYEBROW}</div>
      <div className="report-model-grid">
        {cells.map((cell, index) => (
          <div
            key={cell.label}
            className={`report-model-cell${index < 4 ? "" : " report-model-cell--row2"}${
              index % 4 !== 3 ? " report-model-cell--border-r" : ""
            }`}
          >
            <div className="report-model-cell-value">{cell.value}</div>
            <div className="report-model-cell-label">{cell.label}</div>
          </div>
        ))}
      </div>
      <div className="report-model-strip">
        <strong>No double-counting.</strong> {MODEL_CARD_NO_DOUBLE.replace(/^No double-counting\.\s*/, "")}{" "}
        {MODEL_CARD_DISCLAIMER}
      </div>
    </div>
  );
}

function OpportunityPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page report-page--opportunity">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <div className="report-p1-hero">
          <span className="report-badge">Personalized Analysis</span>
          <h1 className="report-hero-headline">{PAGE1_HERO_HEADLINE}</h1>
          <p className="report-lead">{PAGE1_SUPPORTING_LINE}</p>
          {model.prospect.preparedForLine ? (
            <p className="report-personalization">{model.prospect.preparedForLine}</p>
          ) : null}
        </div>

        <div className="report-p1-stack">
          <div className="report-card-dark report-hero-card">
            <div className="report-hero-label">Moderate modeled annual opportunity</div>
            <div className="report-hero-value">{model.moderateHeroTotalFormatted}</div>
            <div className="report-hero-context">{model.operation.contextLine}</div>
          </div>
          <ScenarioRangeSlider model={model} />
        </div>

        <div className="report-p1-drivers">
          <SectionHeading number="01" title={SECTION_01_TITLE} align="left" />
          <div className="report-driver-row-list">
            {DRIVER_DISPLAY_ORDER.map((key) => (
              <DriverRow key={key} model={model} driverKey={key} />
            ))}
          </div>
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
  const blocks = model.tradeContent.blocks;

  return (
    <section className="report-page report-page--problem">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <div className="report-p2-intro">
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

        <div className="report-p2-narrative">
          {SECTION_02_NARRATIVE.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>

        <div className="report-p2-diagnostics">
          <SectionHeading number="03" title={SECTION_03_TITLE} align="left" />
          {blocks.slice(0, 2).map((block, index) => (
            <TradeDiagnosticBlock
              key={block.title}
              {...block}
              driverKey={BLOCK_DRIVER_KEYS[index]!}
            />
          ))}
        </div>
      </div>
      <ReportFooter model={model} page={2} />
    </section>
  );
}

function MethodologyPage({ model, logoSrc }: RoiReportProps) {
  const blocks = model.tradeContent.blocks;

  return (
    <section className="report-page report-page--methodology">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body report-page-body--spread">
        <div className="report-p3-diagnostics">
          {blocks.slice(2).map((block, index) => (
            <TradeDiagnosticBlock
              key={block.title}
              {...block}
              driverKey={BLOCK_DRIVER_KEYS[index + 2]!}
            />
          ))}
        </div>

        <div className="report-p3-methodology">
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
        </div>
      </div>
      <ReportFooter model={model} page={3} />
    </section>
  );
}

function ActionPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page report-page--action">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body report-page-body--spread">
        <div className="report-p4-top">
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
        </div>

        <div className="report-orchestration">
          <div className="report-orchestration-head">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="report-orchestration-logo" />
            ) : null}
            <h3 className="report-orchestration-title">{ORCHESTRATION_TITLE}</h3>
          </div>
          <div className="report-orchestration-grid">
            {ORCHESTRATION_COLUMNS.map((col) => {
              const PillarIcon = PILLAR_ICONS[col.label];
              return (
                <div key={col.label} className="report-orchestration-col">
                  <div className="report-orchestration-col-head">
                    <span className="report-orchestration-icon-wrap">
                      <PillarIcon className="report-icon-svg report-icon-svg--sm" />
                    </span>
                    <span>{col.label}</span>
                  </div>
                  <div className="report-orchestration-col-body">
                    {col.items.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="report-orchestration-foot">{ORCHESTRATION_FOOTNOTE}</div>
        </div>

        <div className="report-p4-guarantee">
          <SectionHeading number="05" title={SECTION_05_TITLE} align="center" />
          <div className="report-guarantee">
            <ShieldIcon className="report-guarantee-icon" />
            <h3 className="report-guarantee-title">{GUARANTEE_CARD_TITLE}</h3>
            <p>{model.guarantee.body}</p>
            <small>{model.guarantee.footnote}</small>
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
      <MethodologyPage model={model} logoSrc={logoSrc} />
      <ActionPage model={model} logoSrc={logoSrc} />
    </div>
  );
}
