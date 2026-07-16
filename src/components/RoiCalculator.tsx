import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  BOOK_MEETING_URL,
  FEATURE_FLAGS,
  MAX_TRUCK_COUNT,
} from "~/config/features";
import {
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import {
  estimateMonthlyCalls,
  getTradeKeys,
  TRADES,
  type TradeKey,
} from "~/lib/roi/callVolume";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { generateRoiPdf } from "~/server/generateRoiPdf";
import {
  getFullBreakdown,
  getTeaserRevenue,
  unlockRevenue,
  type ScenarioBreakdown,
} from "~/server/revenueResults";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const emptyLead: LeadInfo = {
  name: "",
  businessName: "",
  email: "",
  phone: "",
};

const DRIVER_LABELS = [
  "Missed-Call Recovery",
  "No-Show Reduction",
  "Outbound SMS Campaigns",
  "Job-Closer Upsells",
  "Time Savings",
] as const;

function LockedBreakdownSkeleton() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {["Conservative", "Moderate", "Aggressive"].map((name, index) => (
          <div
            key={name}
            className={`rounded-xl border p-5 ${
              index === 0
                ? "border-brand-primary bg-emerald-50/50"
                : "border-gray-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
              {name}
            </p>
            <div className="mt-3 h-8 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 rounded bg-gray-100" />
            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-6 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-6 w-2/3 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="h-5 w-1/2 rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {DRIVER_LABELS.map((label) => (
            <div key={label} className="flex justify-between gap-4">
              <div className="h-4 w-1/3 rounded bg-gray-100" />
              <div className="h-4 w-1/4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownResults({
  scenarios,
  showDrivers,
  onToggleDrivers,
}: {
  scenarios: ScenarioBreakdown[];
  showDrivers: boolean;
  onToggleDrivers: () => void;
}) {
  const moderate = scenarios[1];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {scenarios.map((result, index) => (
          <div
            key={result.scenario}
            className={`rounded-xl border p-5 ${
              index === 0
                ? "border-brand-primary bg-emerald-50/50 ring-2 ring-brand-primary/20"
                : "border-gray-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
              {result.scenario}
            </p>
            <p className="text-sm text-gray-500">
              {index === 0
                ? result.scenarioLabel
                : `And up to ${result.scenarioLabel}`}
            </p>
            <p className="mt-3 text-2xl font-bold text-brand-secondary">
              {formatCurrency(result.total)}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Revenue you&apos;re missing / year
            </p>
            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 text-sm">
              <div>
                <p className="font-semibold text-brand-secondary">
                  Slipping away right now
                </p>
                <p className="mt-0.5 font-semibold text-brand-primary">
                  {formatCurrency(result.missingNow)}/yr
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Missed-Call Recovery + No-Show Reduction
                </p>
              </div>
              <div>
                <p className="font-semibold text-brand-secondary">
                  Untapped upside
                </p>
                <p className="mt-0.5 font-semibold text-brand-primary">
                  {formatCurrency(result.upside)}/yr
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Outbound Campaigns + Job-Closer Upsells + Time Savings
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={onToggleDrivers}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-brand-secondary hover:bg-gray-50"
        >
          <span>Five value drivers (Moderate scenario)</span>
          <span className="text-brand-accent">{showDrivers ? "−" : "+"}</span>
        </button>
        {showDrivers && moderate && (
          <div className="mt-2 space-y-3 rounded-lg border border-gray-100 bg-brand-accent-light p-4">
            {moderate.drivers.map((driver) => (
              <div
                key={driver.key}
                className="flex flex-col gap-1 border-b border-gray-200 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-brand-secondary">
                    {driver.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {driver.monthlyUnits}{" "}
                    {driver.label === "Time Savings"
                      ? "admin hrs/mo"
                      : "jobs or appts/mo"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-brand-primary">
                  {formatCurrency(driver.annualValue)}/yr
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RoiCalculator() {
  const [trade, setTrade] = useState<TradeKey | "">("");
  const [truckInput, setTruckInput] = useState("");
  const [callsInput, setCallsInput] = useState("");
  const [callsTouched, setCallsTouched] = useState(false);
  const [hero, setHero] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<ScenarioBreakdown[] | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [loadingTeaser, setLoadingTeaser] = useState(false);
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadInfo>(emptyLead);
  const [websiteOption, setWebsiteOption] = useState<"has" | "none" | "">("");
  const [website, setWebsite] = useState("");

  const truckCount = parseInt(truckInput, 10);
  const hasValidTrucks =
    trade !== "" && Number.isFinite(truckCount) && truckCount >= 1;
  const clampedTrucks = hasValidTrucks
    ? Math.min(truckCount, MAX_TRUCK_COUNT)
    : null;

  const estimatedCalls =
    trade !== "" && clampedTrucks !== null
      ? estimateMonthlyCalls(trade, clampedTrucks)
      : null;

  const callsPerTruck =
    trade !== "" ? TRADES[trade].callsPerTruckPerMonth : null;

  const effectiveCallsInput =
    callsTouched && callsInput !== ""
      ? callsInput
      : String(estimatedCalls ?? "");

  const monthlyCalls = parseInt(effectiveCallsInput, 10);
  const hasValidCalls = Number.isFinite(monthlyCalls) && monthlyCalls > 0;

  const resultsGateActive =
    FEATURE_FLAGS.REQUIRE_LEAD_FOR_RESULTS && !unlocked;
  const showResults = hero !== null;

  const resetResults = () => {
    setHero(null);
    setBreakdown(null);
    setUnlocked(false);
    setShowDrivers(false);
    setError(null);
    setWebsiteOption("");
    setWebsite("");
  };

  const handleTradeChange = (value: string) => {
    setTrade(value as TradeKey | "");
    setTruckInput("");
    setCallsInput("");
    setCallsTouched(false);
    resetResults();
  };

  const handleTruckChange = (value: string) => {
    setTruckInput(value);
    setCallsTouched(false);
    setCallsInput("");
    resetResults();
  };

  const handleCallsChange = (value: string) => {
    setCallsInput(value);
    setCallsTouched(true);
    resetResults();
  };

  const handleConfirm = async () => {
    if (!trade || !hasValidCalls) return;

    setLoadingTeaser(true);
    setError(null);
    resetResults();

    try {
      const { hero: teaserHero } = await getTeaserRevenue({
        data: { trade, monthlyCalls },
      });
      setHero(teaserHero);

      if (!FEATURE_FLAGS.REQUIRE_LEAD_FOR_RESULTS) {
        const { scenarios } = await getFullBreakdown({
          data: { trade, monthlyCalls },
        });
        setBreakdown(scenarios);
        setUnlocked(true);
      }
    } catch {
      setError("Could not load your estimate. Please try again.");
    } finally {
      setLoadingTeaser(false);
    }
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trade || !hasValidCalls || clampedTrucks === null) return;

    const validationError = validateLeadInfo(lead);
    if (validationError) {
      setError(validationError);
      return;
    }

    const websiteError = validateWebsiteFields(websiteOption, website);
    if (websiteError) {
      setError(websiteError);
      return;
    }

    setLoadingUnlock(true);
    setError(null);

    try {
      const { scenarios } = await unlockRevenue({
        data: {
          trade,
          monthlyCalls,
          truckCount: clampedTrucks,
          lead,
          websiteOption,
          website: websiteOption === "has" ? website : undefined,
        },
      });
      setBreakdown(scenarios);
      setUnlocked(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not unlock your breakdown. Please try again.",
      );
    } finally {
      setLoadingUnlock(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!trade || !clampedTrucks || !hasValidCalls || !unlocked || !breakdown)
      return;

    setDownloading(true);
    setError(null);

    try {
      const { base64, filename } = await generateRoiPdf({
        data: {
          trade,
          truckCount: clampedTrucks,
          monthlyCalls,
          lead,
          websiteOption,
          website: websiteOption === "has" ? website : undefined,
        },
      });

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate PDF. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const updateLead = (field: keyof LeadInfo, value: string) => {
    setLead((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <div>
      <Card className="mx-auto max-w-5xl">
        <div className="space-y-8">
          <div>
            <label
              htmlFor="trade"
              className="block text-sm font-bold text-brand-secondary"
            >
              Step 1 — Select your trade
            </label>
            <select
              id="trade"
              value={trade}
              onChange={(e) => handleTradeChange(e.target.value)}
              className={inputClassName}
            >
              <option value="">Choose a trade…</option>
              {getTradeKeys().map((key) => (
                <option key={key} value={key}>
                  {TRADES[key].label}
                </option>
              ))}
            </select>
          </div>

          {trade !== "" && (
            <div className="animate-fade-in">
              <label
                htmlFor="trucks"
                className="block text-sm font-bold text-brand-secondary"
              >
                Step 2 — How many trucks do you have?
              </label>
              <input
                id="trucks"
                type="number"
                min={1}
                max={MAX_TRUCK_COUNT}
                value={truckInput}
                onChange={(e) => handleTruckChange(e.target.value)}
                placeholder="e.g. 5"
                className={inputClassName}
              />
              {hasValidTrucks && truckCount > MAX_TRUCK_COUNT && (
                <p className="mt-2 text-sm text-amber-600">
                  Capped at {MAX_TRUCK_COUNT} trucks for this estimate. You can
                  enter exact call volume below.
                </p>
              )}
            </div>
          )}

          {trade !== "" &&
            hasValidTrucks &&
            clampedTrucks !== null &&
            estimatedCalls !== null &&
            callsPerTruck !== null && (
            <div className="animate-fade-in rounded-xl border border-gray-200 bg-brand-accent-light p-6">
              <p className="text-lg font-semibold text-brand-secondary">
                Step 3 — Estimated monthly calls
              </p>
              <p className="mt-3 text-sm text-gray-700">
                <span className="font-semibold text-brand-secondary">
                  {clampedTrucks.toLocaleString("en-US")}
                </span>{" "}
                trucks ×{" "}
                <span className="font-semibold text-brand-secondary">
                  {callsPerTruck}
                </span>{" "}
                calls/truck ={" "}
                <span className="font-semibold text-brand-primary">
                  {estimatedCalls.toLocaleString("en-US")}
                </span>{" "}
                calls/month
              </p>
            </div>
          )}

          {trade !== "" && hasValidTrucks && estimatedCalls !== null && (
            <div className="animate-fade-in rounded-xl bg-[#18222f] p-6 text-white">
              <p className="text-lg font-semibold">
                Step 4 — Verify your call volume
              </p>
              <p className="mt-2 text-sm text-gray-300">
                Is{" "}
                <strong className="text-brand-primary">
                  {estimatedCalls.toLocaleString("en-US")}
                </strong>{" "}
                about how many calls you take per month? If not, enter your
                actual monthly call volume below.
              </p>
              <label
                htmlFor="calls"
                className="mt-4 block text-sm font-medium text-gray-300"
              >
                Monthly inbound calls
              </label>
              <input
                id="calls"
                type="number"
                min={1}
                value={effectiveCallsInput}
                onChange={(e) => handleCallsChange(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#18222f] px-4 py-3 text-sm text-white focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasValidCalls || loadingTeaser}
                >
                  {loadingTeaser
                    ? "Calculating…"
                    : "Show Me What I'm Missing"}
                </Button>
              </div>
            </div>
          )}

          {showResults && hero !== null && (
            <div className="animate-slide-up space-y-8">
              <div className="rounded-xl border border-brand-primary/30 bg-emerald-50/60 p-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent">
                  Conservative estimate
                </p>
                <p className="mt-3 text-4xl font-extrabold tracking-tight text-brand-secondary sm:text-5xl">
                  You&apos;re missing about{" "}
                  <span className="text-brand-primary">
                    {formatCurrency(hero)}+
                  </span>{" "}
                  every year
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  {TRADES[trade].label} · {clampedTrucks} trucks ·{" "}
                  {monthlyCalls.toLocaleString("en-US")} calls/mo
                </p>
              </div>

              <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6 sm:p-8 text-center">
                <h3 className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
                  90-Day{" "}
                  <span className="text-brand-primary">Results Guarantee</span>
                </h3>
                <p className="mt-4 text-base leading-relaxed text-brand-secondary">
                  We guarantee you recover at least our service investment in
                  booked service-visit revenue within 90 days of go-live —{" "}
                  <span className="font-semibold text-brand-primary">
                    or we keep working, for free, until you do.
                  </span>
                </p>
                <p className="mt-3 text-base leading-relaxed text-brand-secondary">
                  If we don&apos;t perform, you don&apos;t pay beyond the{" "}
                  <span className="font-medium">Results Engagement Period</span>.
                </p>
              </div>

              <div className="relative">
                {resultsGateActive ? (
                  <>
                    <div className="blur-sm">
                      <LockedBreakdownSkeleton />
                    </div>
                    <div className="absolute inset-0 flex items-start justify-center bg-white/40 p-4 pt-8 backdrop-blur-[2px] sm:items-center sm:p-8">
                      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
                        <h3 className="text-xl font-bold tracking-tight text-brand-secondary">
                          Unlock your full breakdown
                        </h3>
                        <p className="mt-2 text-sm text-gray-600">
                          See all three scenarios, bucket totals, and per-driver
                          detail — plus download your PDF report.
                        </p>
                        <form
                          onSubmit={handleUnlock}
                          className="mt-6 grid gap-4 sm:grid-cols-2"
                        >
                          <div className="sm:col-span-2">
                            <label
                              htmlFor="unlock-name"
                              className="block text-sm font-medium text-gray-700"
                            >
                              Name
                            </label>
                            <input
                              id="unlock-name"
                              type="text"
                              value={lead.name}
                              onChange={(e) =>
                                updateLead("name", e.target.value)
                              }
                              placeholder="John Smith"
                              className={inputClassName}
                              autoComplete="name"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label
                              htmlFor="unlock-business"
                              className="block text-sm font-medium text-gray-700"
                            >
                              Business name
                            </label>
                            <input
                              id="unlock-business"
                              type="text"
                              value={lead.businessName}
                              onChange={(e) =>
                                updateLead("businessName", e.target.value)
                              }
                              placeholder="Your Company LLC"
                              className={inputClassName}
                              autoComplete="organization"
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="unlock-email"
                              className="block text-sm font-medium text-gray-700"
                            >
                              Email
                            </label>
                            <input
                              id="unlock-email"
                              type="email"
                              value={lead.email}
                              onChange={(e) =>
                                updateLead("email", e.target.value)
                              }
                              placeholder="john@yourcompany.com"
                              className={inputClassName}
                              autoComplete="email"
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="unlock-phone"
                              className="block text-sm font-medium text-gray-700"
                            >
                              Phone number
                            </label>
                            <input
                              id="unlock-phone"
                              type="tel"
                              value={lead.phone}
                              onChange={(e) =>
                                updateLead("phone", e.target.value)
                              }
                              placeholder="(555) 123-4567"
                              className={inputClassName}
                              autoComplete="tel"
                              required
                            />
                          </div>
                          <fieldset className="space-y-3 sm:col-span-2">
                            <legend className="block text-sm font-medium text-gray-700">
                              What is your website?
                            </legend>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="radio"
                                name="unlock-websiteOption"
                                value="has"
                                checked={websiteOption === "has"}
                                onChange={() => {
                                  setWebsiteOption("has");
                                  setError(null);
                                }}
                                required
                              />
                              I have a website
                            </label>
                            {websiteOption === "has" && (
                              <input
                                type="text"
                                id="unlock-website"
                                value={website}
                                onChange={(e) => {
                                  setWebsite(e.target.value);
                                  setError(null);
                                }}
                                className={inputClassName}
                                placeholder="https://yourcompany.com"
                                autoComplete="url"
                                required
                              />
                            )}
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="radio"
                                name="unlock-websiteOption"
                                value="none"
                                checked={websiteOption === "none"}
                                onChange={() => {
                                  setWebsiteOption("none");
                                  setWebsite("");
                                  setError(null);
                                }}
                              />
                              I don&apos;t have a website
                            </label>
                          </fieldset>
                          <div className="sm:col-span-2">
                            <Button
                              type="submit"
                              disabled={loadingUnlock}
                              className="w-full"
                            >
                              {loadingUnlock
                                ? "Unlocking…"
                                : "Unlock Full Breakdown"}
                            </Button>
                          </div>
                        </form>
                        {error && (
                          <p className="mt-3 text-sm text-red-600" role="alert">
                            {error}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  breakdown && (
                    <BreakdownResults
                      scenarios={breakdown}
                      showDrivers={showDrivers}
                      onToggleDrivers={() => setShowDrivers((v) => !v)}
                    />
                  )
                )}
              </div>

              {unlocked && breakdown && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-brand-secondary">
                    Your full report
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Download a PDF of your complete revenue gap estimate or book
                    a call with our team.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <a href={BOOK_MEETING_URL}>
                      <Button type="button">Book a Meeting</Button>
                    </a>
                    {FEATURE_FLAGS.REQUIRE_LEAD_FOR_PDF && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleDownloadPdf}
                        disabled={downloading}
                      >
                        {downloading
                          ? "Generating PDF…"
                          : "Download PDF Report"}
                      </Button>
                    )}
                  </div>
                  {error && !resultsGateActive && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && !showResults && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
