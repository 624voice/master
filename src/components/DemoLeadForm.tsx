const inputClassName =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const labelClassName = "block text-sm font-medium text-gray-700";

export type DemoLeadFormProps = {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  businessName: string;
  setBusinessName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  smsConsent: boolean;
  setSmsConsent: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onClearError: () => void;
};

export function DemoLeadForm(props: DemoLeadFormProps) {
  return (
    <form onSubmit={props.onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="demo-firstName" className={labelClassName}>
            First Name
          </label>
          <input
            id="demo-firstName"
            type="text"
            required
            value={props.firstName}
            onChange={(e) => props.setFirstName(e.target.value)}
            className={inputClassName}
            placeholder="John"
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor="demo-lastName" className={labelClassName}>
            Last Name
          </label>
          <input
            id="demo-lastName"
            type="text"
            required
            value={props.lastName}
            onChange={(e) => props.setLastName(e.target.value)}
            className={inputClassName}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </div>
      </div>
      <div>
        <label htmlFor="demo-businessName" className={labelClassName}>
          Business Name
        </label>
        <input
          id="demo-businessName"
          type="text"
          required
          value={props.businessName}
          onChange={(e) => props.setBusinessName(e.target.value)}
          className={inputClassName}
          placeholder="Smith Plumbing"
          autoComplete="organization"
        />
      </div>
      <div>
        <label htmlFor="demo-phone" className={labelClassName}>
          Phone Number
        </label>
        <input
          id="demo-phone"
          type="tel"
          required
          value={props.phone}
          onChange={(e) => props.setPhone(e.target.value)}
          className={inputClassName}
          placeholder="(555) 123-4567"
          autoComplete="tel"
        />
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={props.smsConsent}
          onChange={(e) => {
            props.setSmsConsent(e.target.checked);
            props.onClearError();
          }}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/20"
        />
        <span className="text-xs leading-relaxed text-gray-600">
          Optional: Text me about my demo or next steps. Message and data rates may apply. Reply STOP to opt out.
        </span>
      </label>
      {props.error && (
        <p className="text-sm text-red-600" role="alert">
          {props.error}
        </p>
      )}
      <button
        type="submit"
        disabled={props.loading}
        className="w-full rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {props.loading ? "Submitting…" : "Continue"}
      </button>
    </form>
  );
}
