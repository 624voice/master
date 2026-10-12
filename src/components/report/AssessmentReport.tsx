import type {
  AssessmentReportDimensionView,
  AssessmentReportViewModel,
} from "~/lib/assessment/buildAssessmentReportViewModel";

type AssessmentReportProps = {
  model: AssessmentReportViewModel;
  logoSrc?: string;
};

const DIMENSION_CARD_ORDER = [
  "Respond",
  "Get Found",
  "Convert",
  "Retain and Grow",
  "Reduce Manual Work",
  "Measure and Improve",
] as const;

function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPct(value: number): string {
  return `${value}%`;
}

function formatSource(source: string): string {
  return source.replace(/_/g, " ");
}

function collectDimensions(
  model: AssessmentReportViewModel,
): AssessmentReportDimensionView[] {
  return [...model.rankedGroups.flat(), ...model.clarifyGroup];
}

function dimensionCards(model: AssessmentReportViewModel): AssessmentReportDimensionView[] {
  const byLabel = new Map(
    collectDimensions(model).map((dimension) => [dimension.label, dimension]),
  );

  return DIMENSION_CARD_ORDER.map(
    (label) =>
      byLabel.get(label) ?? {
        label,
        status: "needs_clarification" as const,
        confidence: "Low",
      },
  );
}

function ReportHeader({ model, logoSrc }: AssessmentReportProps) {
  return (
    <header className="report-header">
      <div className="report-brand">
        {logoSrc ? <img src={logoSrc} alt="" className="report-logo-header" /> : null}
        <div className="report-brand-name">
          624 <span>Voice</span>
        </div>
      </div>
      <div className="report-meta">
        <div className="report-meta-title">AI Revenue &amp; Operations Assessment</div>
        <div>{formatReportDate(model.generatedAtIso)}</div>
      </div>
    </header>
  );
}

function DimensionCard({ dimension }: { dimension: AssessmentReportDimensionView }) {
  return (
    <div className="assessment-dimension-card report-card">
      <div className="assessment-dimension-label">{dimension.label}</div>
      {dimension.status === "scored" && dimension.band ? (
        <div className="assessment-dimension-band">{dimension.band}</div>
      ) : (
        <div className="assessment-dimension-clarify">Needs clarification</div>
      )}
      <div className="assessment-dimension-confidence">
        {dimension.confidence} confidence
      </div>
    </div>
  );
}

function RespondEstimateSection({ model }: { model: AssessmentReportViewModel }) {
  const { respondAssumptions } = model;

  return (
    <section className="assessment-respond-section report-card">
      <div className="assessment-respond-head">
        <h2 className="assessment-section-title">Respond estimate</h2>
        <p className="assessment-combined-label">{model.combinedLabel}</p>
      </div>

      {model.moderateAnnualBenefitFormatted ? (
        <div className="assessment-respond-hero">
          <div className="assessment-respond-hero-label">
            Moderate modeled annual opportunity
          </div>
          <div className="assessment-respond-hero-value">
            {model.moderateAnnualBenefitFormatted}
          </div>
        </div>
      ) : (
        <p className="assessment-respond-unavailable">
          A dollar estimate is not available with the current inputs.
        </p>
      )}

      <div className="assessment-respond-grid">
        <div className="assessment-respond-cell">
          <div className="assessment-respond-value">
            {respondAssumptions.monthlyCalls.toLocaleString("en-US")}
          </div>
          <div className="assessment-respond-label">Calls / month</div>
          <div className="assessment-respond-source">
            {formatSource(respondAssumptions.r1Source)}
          </div>
        </div>
        <div className="assessment-respond-cell">
          <div className="assessment-respond-value">
            {formatPct(respondAssumptions.missedCallRatePct)}
          </div>
          <div className="assessment-respond-label">Missed call rate</div>
          <div className="assessment-respond-source">
            {formatSource(respondAssumptions.r2Source)}
          </div>
        </div>
        <div className="assessment-respond-cell">
          <div className="assessment-respond-value">
            ${respondAssumptions.avgJobValue.toLocaleString("en-US")}
          </div>
          <div className="assessment-respond-label">Avg job value</div>
          <div className="assessment-respond-source">
            {formatSource(respondAssumptions.r3Source)}
          </div>
        </div>
      </div>
    </section>
  );
}

function PriorityGroupsSection({ model }: { model: AssessmentReportViewModel }) {
  return (
    <section className="assessment-priority-section">
      <h2 className="assessment-section-title">Priority groups</h2>
      <div className="assessment-priority-groups">
        {model.rankedGroups.map((group, groupIndex) => (
          <div key={`priority-${groupIndex}`} className="assessment-priority-group report-card">
            <div className="assessment-priority-rank">Priority {groupIndex + 1}</div>
            <ul className="assessment-priority-list">
              {group.map((dimension) => (
                <li key={dimension.label}>
                  <span className="assessment-priority-name">{dimension.label}</span>
                  <span className="assessment-priority-detail">
                    {dimension.status === "scored" && dimension.band
                      ? `${dimension.band} · ${dimension.confidence} confidence`
                      : "Needs clarification"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {model.clarifyGroup.length > 0 ? (
          <div className="assessment-priority-group report-card assessment-priority-group--clarify">
            <div className="assessment-priority-rank">Needs clarification</div>
            <ul className="assessment-priority-list">
              {model.clarifyGroup.map((dimension) => (
                <li key={dimension.label}>
                  <span className="assessment-priority-name">{dimension.label}</span>
                  <span className="assessment-priority-detail">
                    {dimension.confidence} confidence
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AssessmentReport({
  model,
  logoSrc = "/report-logo.png",
}: AssessmentReportProps) {
  const cards = dimensionCards(model);

  return (
    <div className="report-root assessment-report-root">
      <section className="report-page report-page--assessment">
        <ReportHeader model={model} logoSrc={logoSrc} />

        <div className="report-page-body">
          <div className="assessment-intro">
            <span className="report-badge">Personalized Assessment</span>
            <h1 className="report-hero-headline">Your AI Revenue &amp; Operations Snapshot</h1>
            <p className="report-lead">
              Six readiness dimensions ranked by urgency, with a Respond estimate grounded in
              your inputs.
            </p>
          </div>

          <RespondEstimateSection model={model} />

          <section className="assessment-dimensions-section">
            <h2 className="assessment-section-title">Dimension scores</h2>
            <div className="assessment-dimension-grid">
              {cards.map((dimension) => (
                <DimensionCard key={dimension.label} dimension={dimension} />
              ))}
            </div>
          </section>

          <PriorityGroupsSection model={model} />

          <p className="assessment-disclaimer">{model.disclaimer}</p>
        </div>
      </section>
    </div>
  );
}
