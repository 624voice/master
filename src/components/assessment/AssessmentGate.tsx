import { useState } from "react";
import { Button } from "~/components/ui/Button";
import {
  normalizeLeadInfo,
  validateLeadInfo,
  type LeadInfo,
} from "~/lib/lead/validateLead";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const emptyLead: LeadInfo = {
  firstName: "",
  lastName: "",
  businessName: "",
  email: "",
  phone: "",
};

type AssessmentGateProps = {
  loading: boolean;
  onSubmit: (lead: LeadInfo, smsConsent: boolean) => void;
};

export function AssessmentGate({ loading, onSubmit }: AssessmentGateProps) {
  const [lead, setLead] = useState<LeadInfo>(emptyLead);
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLead = (field: keyof LeadInfo, value: string) => {
    setLead((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateLeadInfo(lead);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(normalizeLeadInfo(lead), smsConsent);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold tracking-tight text-brand-secondary">
        Unlock your full assessment results
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Enter your details to see ranked priorities, clarification areas, and
        your downloadable report.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="gate-first-name"
            className="block text-sm font-medium text-gray-700"
          >
            First name
          </label>
          <input
            id="gate-first-name"
            type="text"
            value={lead.firstName}
            onChange={(event) => updateLead("firstName", event.target.value)}
            placeholder="F.1 first name placeholder"
            className={inputClassName}
            autoComplete="given-name"
            required
          />
        </div>
        <div>
          <label
            htmlFor="gate-last-name"
            className="block text-sm font-medium text-gray-700"
          >
            Last name
          </label>
          <input
            id="gate-last-name"
            type="text"
            value={lead.lastName}
            onChange={(event) => updateLead("lastName", event.target.value)}
            placeholder="F.1 last name placeholder"
            className={inputClassName}
            autoComplete="family-name"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="gate-business"
            className="block text-sm font-medium text-gray-700"
          >
            Business name
          </label>
          <input
            id="gate-business"
            type="text"
            value={lead.businessName}
            onChange={(event) =>
              updateLead("businessName", event.target.value)
            }
            placeholder="F.1 business name placeholder"
            className={inputClassName}
            autoComplete="organization"
            required
          />
        </div>
        <div>
          <label
            htmlFor="gate-email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="gate-email"
            type="email"
            value={lead.email}
            onChange={(event) => updateLead("email", event.target.value)}
            placeholder="F.1 email placeholder"
            className={inputClassName}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label
            htmlFor="gate-phone"
            className="block text-sm font-medium text-gray-700"
          >
            Phone number
          </label>
          <input
            id="gate-phone"
            type="tel"
            value={lead.phone}
            onChange={(event) => updateLead("phone", event.target.value)}
            placeholder="F.1 phone placeholder"
            className={inputClassName}
            autoComplete="tel"
            required
          />
        </div>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(event) => {
              setSmsConsent(event.target.checked);
              setError(null);
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20"
          />
          <span className="text-sm text-gray-600">
            I agree to receive text messages from 624 Voice about my assessment
            results. Message and data rates may apply. Reply STOP to opt out.
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting…" : "See My Full Results"}
          </Button>
        </div>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
