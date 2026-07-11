import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { FEATURE_FLAGS, MAX_TRUCK_COUNT, ROI_DISCLAIMER } from "~/config/features";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import {
  AUDIT_NOTES,
  getAssumptionLines,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import {
  formatCurrency,
  formatMultiple,
  formatPaybackMonths,
} from "~/lib/roi/formatCurrency";
import {
  getTradeKeys,
  SCENARIOS,
  TRADES,
  trucksToCalls,
  type TradeKey,
} from "~/lib/roi/roiModel";
import { generateRoiPdf } from "~/server/generateRoiPdf";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

export function RoiCalculator() {
  const [trade, setTrade] = useState<TradeKey | "">("");
  const [truckInput, setTruckInput] = useState("");
  const [callsInput, setCallsInput] = useState("");
  const [callsTouched, setCallsTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const truckCount = parseInt(truckInput, 10);
  const hasValidTrucks =
    trade !== "" && Number.isFinite(truckCount) && truckCount >= 1;
  const clampedTrucks = hasValidTrucks
    ? Math.min(truckCount, MAX_TRUCK_COUNT)
    : null;

  const mappedCalls =
    trade !== "" && clampedTrucks !== null
      ? trucksToCalls(trade, clampedTrucks)
      : null;

  const effectiveCallsInput =
    callsTouched && callsInput !== "" ? callsInput : String(mappedCalls ?? "");

  const monthlyCalls = parseInt(effectiveCallsInput, 10);
  const hasValidCalls = Number.isFinite(monthlyCalls) && monthlyCalls > 0;

  const results =
    confirmed && trade !== "" && hasValidCalls
      ? computeAllScenarios(trade, monthlyCalls)
      : null;

  const handleTradeChange = (value: string) => {
    setTrade(value as TradeKey | "");
    setTruckInput("");
    setCallsInput("");
    setCallsTouched(false);
    setConfirmed(false);
    setShowDrivers(false);
    setError(null);
  };

  const handleTruckChange = (value: string) => {
    setTruckInput(value);
    setCallsTouched(false);
    setCallsInput("");
    setConfirmed(false);
    setShowDrivers(false);
    setError(null);
  };

  const handleCallsChange = (value: string) => {
    setCallsInput(value);
    setCallsTouched(true);
    setConfirmed(false);
    setShowDrivers(false);
  };

  const handleConfirm = () => {
    if (hasValidCalls) {
      setConfirmed(true);
      setError(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!trade || !clampedTrucks || !hasValidCalls || !results) return;

    setDownloading(true);
    setError(null);

    try {
      const { base64, filename } = await generateRoiPdf({
        data: {
          trade,
          truckCount: clampedTrucks,
          monthlyCalls,
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
    } catch {
      setError("Could not generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="font-[family-name:var(--font-body)]">
      <Card className="mx-auto max-w-5xl">
        <div className="space-y-8">
          {/* Step 1: Trade */}
          <div>
            <label
              htmlFor="trade"
              className="block font-[family-name:var(--font-emphasis)] text-sm font-bold text-brand-secondary"
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

          {/* Step 2: Trucks */}
          {trade !== "" && (
            <div className="animate-fade-in">
              <label
                htmlFor="trucks"
                className="block font-[family-name:var(--font-emphasis)] text-sm font-bold text-brand-secondary"
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

          {/* Step 3: Confirm calls */}
          {trade !== "" && hasValidTrucks && mappedCalls !== null && (
            <div className="animate-fade-in rounded-xl bg-[#18222f] p-6 text-white">
              <p className="font-[family-name:var(--font-heading)] text-lg font-medium">
                Step 3 — Confirm your call volume
              </p>
              <p className="mt-2 text-sm text-gray-300">
                You get about{" "}
                <strong className="text-brand-primary">
                  {mappedCalls.toLocaleString("en-US")}
                </strong>{" "}
                calls a month — is that right?
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
                  disabled={!hasValidCalls}
                >
                  Calculate ROI
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="animate-slide-up space-y-8">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-medium text-brand-secondary">
                  Your estimated annual ROI
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {TRADES[trade].label} · {clampedTrucks} trucks ·{" "}
                  {monthlyCalls.toLocaleString("en-US")} calls/mo
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {results.map((result, index) => (
                  <div
                    key={SCENARIOS[index]}
                    className={`rounded-xl border p-5 ${
                      index === 1
                        ? "border-brand-primary bg-emerald-50/50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
                      {SCENARIOS[index]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {SCENARIO_LABELS[index]}
                    </p>
                    <p className="mt-3 font-[family-name:var(--font-emphasis)] text-2xl font-bold text-brand-secondary">
                      {formatCurrency(result.netAnnualROI)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Net Annual ROI
                    </p>
                    <div className="mt-4 space-y-1 text-sm text-gray-600">
                      <p>
                        ROI multiple:{" "}
                        <span className="font-semibold text-brand-primary">
                          {formatMultiple(result.roiMultiple)}
                        </span>
                      </p>
                      <p>
                        Payback:{" "}
                        <span className="font-semibold">
                          {formatPaybackMonths(result.paybackMonths)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowDrivers((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-brand-secondary hover:bg-gray-50"
                >
                  <span>Five value drivers (Moderate scenario)</span>
                  <span className="text-brand-accent">{showDrivers ? "−" : "+"}</span>
                </button>
                {showDrivers && (
                  <div className="mt-2 space-y-3 rounded-lg border border-gray-100 bg-brand-accent-light p-4">
                    {(
                      Object.values(results[1]!.drivers) as Array<{
                        label: string;
                        monthlyUnits: number;
                        annualValue: number;
                      }>
                    ).map((driver) => (
                      <div
                        key={driver.label}
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

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-medium text-brand-secondary">
                  Assumptions &amp; audit
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  {getAssumptionLines(trade).map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-brand-secondary">
                    No double-counting
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600">
                    {AUDIT_NOTES.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-xs text-gray-500">{ROI_DISCLAIMER}</p>
              </div>

              {!FEATURE_FLAGS.REQUIRE_EMAIL_FOR_PDF && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                  >
                    {downloading ? "Generating PDF…" : "Download PDF"}
                  </Button>
                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
