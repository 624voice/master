import { CheckCircleIcon, DriverIcon, ShieldIcon } from "~/components/report/ReportIcons";
import type { ReportViewModel } from "~/lib/report/types";
import {
  ABOUT_FOOTNOTE,
  ABOUT_GROUPS,
  ABOUT_POSITIONING,
  DRIVER_DISPLAY,
  DRIVER_DISPLAY_ORDER,
  GUARANTEE_CARD_TITLE,
  METHODOLOGY_PARAGRAPH,
  NO_DOUBLE_COUNTING_NOTE,
  PAGE1_CTA_PREVIEW,
  PAGE1_HERO_HEADLINE,
  PAGE1_SUPPORTING_LINE,
  ROI_RECAP_BODY,
  ROI_RECAP_HEADLINE,
  SECTION_01_SUB,
  SECTION_01_TITLE,
  SECTION_02_PARAGRAPHS,
  SECTION_02_SUB,
  SECTION_02_TITLE,
  SECTION_02_TURN,
  SECTION_03_TITLE,
  SECTION_04_TITLE,
  SECTION_05_TITLE,
  SECTION_06_TITLE,
  type DriverCopyKey,
} from "~/lib/report/reportCopy";

const TOTAL_PAGES = 5;

type RoiReportProps = {
  model: ReportViewModel;
  logoSrc?: string;
};

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.trim();
}

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
  subtitle,
  align = "left",
}: {
  number?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`report-section-heading report-section-heading--${align}`}>
      {number ? <span className="report-section-num">{number}</span> : null}
      <div className="report-section-heading-text">
        <h2 className="report-section-title">{title}</h2>
        {subtitle ? <p className="report-section-sub">{subtitle}</p> : null}
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

  return (
    <div className="report-slider">
      <div className="report-slider-label">The range of what&apos;s recoverable</div>
      <svg className="report-slider-track" viewBox="0 0 640 72" aria-hidden="true">
        <line x1="24" y1="36" x2="616" y2="36" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
        <line x1="24" y1="36" x2="616" y2="36" stroke="#10b981" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
        {model.scenarios.map((scenario, index) => {
          const x = 24 + (positions[index]! / 100) * 592;
          const isModerate = index === 1;
          return (
            <g key={scenario.name}>
              <circle
                cx={x}
                cy="36"
                r={isModerate ? 9 : 7}
                fill={isModerate ? "#10b981" : "#ffffff"}
                stroke={isModerate ? "#059669" : "#94a3b8"}
                strokeWidth="2"
              />
              <text
                x={x}
                y="14"
                textAnchor="middle"
                fontSize="9"
                fontWeight={isModerate ? "700" : "600"}
                fill={isModerate ? "#059669" : "#64748b"}
              >
                {scenario.name}
              </text>
              <text
                x={x}
                y="58"
                textAnchor="middle"
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

function largestDriverHeadline(model: ReportViewModel): string {
  const key = DRIVER_DISPLAY_ORDER.reduce((best, k) =>
    getDriverByKey(model, k).annualValue > getDriverByKey(model, best).annualValue ? k : best,
  );
  return DRIVER_DISPLAY[key].headline;
}

function ExecutivePage({ model, logoSrc }: RoiReportProps) {
  const financialLine = `Based on your numbers, roughly ${model.moderateHeroTotalFormatted} a year may be recoverable.`;

  return (
    <section className="report-page report-page--executive">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <div className="report-p1-editorial">
          <span className="report-badge">PERSONALIZED ANALYSIS</span>
          <h1 className="report-hero-headline">{PAGE1_HERO_HEADLINE}</h1>
          <p className="report-lead">{PAGE1_SUPPORTING_LINE}</p>
          {model.prospect.preparedForLine ? (
            <p className="report-personalization">{model.prospect.preparedForLine}</p>
          ) : null}
        </div>
        <p className="report-financial-line report-financial-line--center">{financialLine}</p>
        <div className="report-p1-centerpiece">
          <div className="report-card-dark report-hero-card">
            <div className="report-hero-label">Moderate modeled annual opportunity</div>
            <div className="report-hero-value">{model.moderateHeroTotalFormatted}</div>
            <div className="report-hero-context">{model.operation.contextLine}</div>
          </div>
          <ScenarioSlider model={model} />
          <div className="report-scenario-grid">
            {model.scenarios.map((scenario, index) => (
              <div
                key={scenario.name}
                className={`report-card report-scenario-card${index === 1 ? " is-moderate" : ""}`}
              >
                <div className="report-scenario-name">{scenario.name}</div>
                <div className="report-scenario-total">{scenario.totalFormatted}</div>
                <div className="report-scenario-range">{scenario.captureRange} capture</div>
              </div>
            ))}
          </div>
        </div>
        <p className="report-cta-preview report-cta-preview--center">{PAGE1_CTA_PREVIEW}</p>
      </div>
      <ReportFooter model={model} page={1} />
    </section>
  );
}

function DriversPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page report-page--drivers">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <SectionHeading
          number="01"
          title={SECTION_01_TITLE}
          subtitle={SECTION_01_SUB}
          align="center"
        />
        <div className="report-card report-drivers-card">
          {DRIVER_DISPLAY_ORDER.map((key) => {
            const driver = getDriverByKey(model, key);
            const copy = DRIVER_DISPLAY[key];
            return (
              <div key={key} className="report-driver-block">
                <div className="report-driver-row">
                  <DriverIcon driverKey={key} />
                  <div className="report-driver-copy">
                    <div className="report-driver-headline">{copy.headline}</div>
                    <div className="report-driver-subline">{copy.subline(driver.monthlyUnits)}</div>
                  </div>
                  <div className="report-driver-annual">{driver.annualValueFormatted}</div>
                </div>
                <div className="report-driver-bar-wrap">
                  <div
                    className="report-driver-bar"
                    style={{ width: `${Math.max(driver.barPercent * 100, 4)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="report-total-row">
            <span>Total modeled annual opportunity</span>
            <span>{model.moderateHeroTotalFormatted}</span>
          </div>
        </div>
        <div className="report-p2-close">
          <div className="report-callout report-callout--center">
            <strong>{largestDriverHeadline(model)}</strong> is the largest modeled driver at{" "}
            {model.largestDriver.annualValueFormatted} annually in the moderate scenario.
          </div>
          <p className="report-note report-note--center">{NO_DOUBLE_COUNTING_NOTE}</p>
        </div>
      </div>
      <ReportFooter model={model} page={2} />
    </section>
  );
}

function LeaksPage({ model, logoSrc }: RoiReportProps) {
  const turnLine = SECTION_02_TURN.replace(
    "{moderateTotal}",
    model.moderateHeroTotalFormatted,
  );

  return (
    <section className="report-page report-page--leaks">
      <ReportHeader model={model} logoSrc={logoSrc} />
      <div className="report-page-body">
        <SectionHeading number="02" title={SECTION_02_TITLE} subtitle={SECTION_02_SUB} align="center" />
        <div className="report-narrative report-narrative--editorial">
          {SECTION_02_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="report-narrative-turn">
            <strong>{turnLine}</strong>
          </p>
        </div>
        <SectionHeading number="03" title={SECTION_03_TITLE} align="left" />
        <div className="report-leak-list">
          {DRIVER_DISPLAY_ORDER.map((driverKey) => {
            const blockIndex = DRIVER_DISPLAY_ORDER.indexOf(driverKey);
            const block = model.tradeContent.blocks[blockIndex]!;
            const driver = getDriverByKey(model, driverKey);
            const label = DRIVER_DISPLAY[driverKey].headline;
            return (
              <div key={driverKey} className="report-leak-row">
                <div className="report-leak-name">{label}</div>
                <div className="report-leak-field">
                  <span className="report-leak-label">Consequence</span>
                  {firstSentence(block.consequence)}
                </div>
                <div className="report-leak-impact">{driver.annualValueFormatted}</div>
                <div className="report-leak-field">
                  <span className="report-leak-label">624Voice</span>
                  {firstSentence(block.response)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ReportFooter model={model} page={3} />
    </section>
  );
}

function MethodologyPage({ model, logoSrc }: RoiReportProps) {
  return (
    <section className="report-page report-page--methodology">
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
        <div className="report-p4-support">
          <p className="report-methodology report-methodology--center">{METHODOLOGY_PARAGRAPH}</p>
          <ul className="report-trade-assumptions report-trade-assumptions--center">
            {model.tradeAssumptions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <SectionHeading number="05" title={SECTION_05_TITLE} align="center" />
        <div className="report-guarantee">
          <ShieldIcon className="report-guarantee-icon" />
          <h3 className="report-guarantee-title">{GUARANTEE_CARD_TITLE}</h3>
          <p>{model.guarantee.body}</p>
          <small>{model.guarantee.footnote}</small>
        </div>
      </div>
      <ReportFooter model={model} page={4} />
    </section>
  );
}

function ClosingPage({ model, logoSrc }: RoiReportProps) {
  const recapHeadline = ROI_RECAP_HEADLINE.replace(
    "{conservativeTotal}",
    model.scenarios[0]!.totalFormatted,
  );

  return (
    <section className="report-page report-page--closing">
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
          <div className="report-about">
            <p className="report-about-lead">
              <strong>{ABOUT_POSITIONING}</strong>
            </p>
            {ABOUT_GROUPS.map((group) => (
              <p key={group.label} className="report-about-group">
                <strong>{group.label}</strong> — {group.items}
              </p>
            ))}
            <p className="report-about-foot">{ABOUT_FOOTNOTE}</p>
          </div>
        </div>
      </div>
      <ReportFooter model={model} page={5} />
    </section>
  );
}

export function RoiReport({ model, logoSrc = "/logo.png" }: RoiReportProps) {
  return (
    <div className="report-root">
      <ExecutivePage model={model} logoSrc={logoSrc} />
      <DriversPage model={model} logoSrc={logoSrc} />
      <LeaksPage model={model} logoSrc={logoSrc} />
      <MethodologyPage model={model} logoSrc={logoSrc} />
      <ClosingPage model={model} logoSrc={logoSrc} />
    </div>
  );
}
