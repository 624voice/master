import {
  getCalculatorDefaults,
  resolveRespondField,
  type VisitorRespondEdits,
} from "~/lib/assessment/engine";
import type { TradeKey } from "~/lib/roi/callVolume";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const FLEET_SIZE_TO_TRUCKS: Record<string, number> = {
  "1-2": 2,
  "3-7": 5,
  "8-20": 14,
  "21-50": 35,
  "50+": 50,
};

function sourceLabel(source: "modeled" | "visitor_provided"): string {
  return source === "modeled" ? "Modeled estimate" : "Your number";
}

type RespondAssumptionsReviewProps = {
  trade: TradeKey;
  fleetSize: string;
  edits: VisitorRespondEdits;
  onChange: (edits: VisitorRespondEdits) => void;
};

function fieldDisplayValue(
  resolvedValue: number,
  edit: number | "not_sure" | undefined,
): string {
  if (edit === "not_sure") return "";
  if (typeof edit === "number") return String(edit);
  return String(resolvedValue);
}

export function RespondAssumptionsReview({
  trade,
  fleetSize,
  edits,
  onChange,
}: RespondAssumptionsReviewProps) {
  const truckCount = FLEET_SIZE_TO_TRUCKS[fleetSize] ?? 5;
  const defaults = getCalculatorDefaults(trade, truckCount);

  const r1 = resolveRespondField(defaults.monthlyCalls, edits.monthlyCalls);
  const r2 = resolveRespondField(
    defaults.missedCallRatePct,
    edits.missedCallRatePct,
  );
  const r3 = resolveRespondField(defaults.avgJobValue, edits.avgJobValue);

  const updateField = (
    key: keyof VisitorRespondEdits,
    raw: string,
    notSure: boolean,
  ) => {
    if (notSure) {
      onChange({ ...edits, [key]: "not_sure" });
      return;
    }
    const parsed = raw.trim() === "" ? undefined : Number(raw);
    onChange({
      ...edits,
      [key]:
        parsed != null && Number.isFinite(parsed) && parsed >= 0
          ? parsed
          : undefined,
    });
  };

  const fields = [
    {
      id: "R1",
      key: "monthlyCalls" as const,
      label: "Monthly inbound calls",
      resolved: r1,
      edit: edits.monthlyCalls,
      placeholder: "e.g. 300",
      step: "1",
    },
    {
      id: "R2",
      key: "missedCallRatePct" as const,
      label: "Missed or unanswered call rate (%)",
      resolved: r2,
      edit: edits.missedCallRatePct,
      placeholder: "e.g. 15",
      step: "0.1",
    },
    {
      id: "R3",
      key: "avgJobValue" as const,
      label: "Average job or ticket value ($)",
      resolved: r3,
      edit: edits.avgJobValue,
      placeholder: "e.g. 350",
      step: "1",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-brand-secondary">
          Review your respond assumptions
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          We pre-filled these from your trade and fleet size. Adjust anything
          that doesn&apos;t look right, or mark a field as not sure.
        </p>
      </div>

      {fields.map((field) => {
        const isNotSure = field.edit === "not_sure";
        return (
          <div key={field.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={`respond-${field.id}`}
                className="block text-sm font-medium text-gray-700"
              >
                {field.label}
              </label>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  field.resolved.source === "modeled"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {sourceLabel(field.resolved.source)}
              </span>
            </div>
            <input
              id={`respond-${field.id}`}
              type="number"
              min={0}
              step={field.step}
              value={fieldDisplayValue(field.resolved.value, field.edit)}
              onChange={(event) =>
                updateField(field.key, event.target.value, false)
              }
              disabled={isNotSure}
              placeholder={field.placeholder}
              className={`${inputClassName} disabled:bg-gray-50 disabled:text-gray-400`}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isNotSure}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange({ ...edits, [field.key]: "not_sure" });
                  } else {
                    onChange({ ...edits, [field.key]: undefined });
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20"
              />
              Not sure
            </label>
          </div>
        );
      })}
    </div>
  );
}
