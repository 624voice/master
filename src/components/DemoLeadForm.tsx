import { CONTACT_TRADES } from "~/lib/lead/validateLead";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-slate-500/30 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const selectClassName =
  "mt-1 block w-full rounded-lg border border-slate-500/30 bg-white/5 px-4 py-2.5 text-sm text-slate-200 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const labelClassName = "block text-sm font-medium text-slate-300";

type DemoLeadFormProps = {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  businessName: string;
  setBusinessName: (value: string) => void;
  trade: string;
  setTrade: (value: string) => void;
  otherTrade: string;
  setOtherTrade: (value: string) => void;
  websiteOption: "has" | "none" | "";
  setWebsiteOption: (value: "has" | "none" | "") => void;
  website: string;
  setWebsite: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  fleetSize: string;
  setFleetSize: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  smsConsent: boolean;
  setSmsConsent: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onClearError: () => void;
};

export function DemoLeadForm(props: DemoLeadFormProps) {
  return (
    <form onSubmit={props.onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="grid gap-4 sm:grid-cols-2">
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
          placeholder="Your Company LLC"
          autoComplete="organization"
        />
      </div>
      <div>
        <label htmlFor="demo-trade" className={labelClassName}>
          Trade
        </label>
        <select
          id="demo-trade"
          value={props.trade}
          onChange={(e) => {
            props.setTrade(e.target.value);
            if (e.target.value !== "Other") {
              props.setOtherTrade("");
            }
          }}
          className={selectClassName}
          required
        >
          <option value="">Select your trade...</option>
          {CONTACT_TRADES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {props.trade === "Other" && (
        <div>
          <label htmlFor="demo-otherTrade" className={labelClassName}>
            Your trade
          </label>
          <input
            id="demo-otherTrade"
            type="text"
            value={props.otherTrade}
            onChange={(e) => props.setOtherTrade(e.target.value)}
            className={inputClassName}
            placeholder="Enter your trade"
            required
          />
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className={labelClassName}>What is your website?</legend>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="radio"
            name="demo-websiteOption"
            value="has"
            checked={props.websiteOption === "has"}
            onChange={() => props.setWebsiteOption("has")}
            required
          />
          I have a website
        </label>
        {props.websiteOption === "has" && (
          <input
            type="text"
            id="demo-website"
            value={props.website}
            onChange={(e) => props.setWebsite(e.target.value)}
            className={inputClassName}
            placeholder="https://yourcompany.com"
            autoComplete="url"
            required
          />
        )}
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="radio"
            name="demo-websiteOption"
            value="none"
            checked={props.websiteOption === "none"}
            onChange={() => {
              props.setWebsiteOption("none");
              props.setWebsite("");
            }}
          />
          I don&apos;t have a website
        </label>
      </fieldset>
      <div>
        <label htmlFor="demo-email" className={labelClassName}>
          Email Address
        </label>
        <input
          id="demo-email"
          type="email"
          required
          value={props.email}
          onChange={(e) => props.setEmail(e.target.value)}
          className={inputClassName}
          placeholder="john@yourcompany.com"
          autoComplete="email"
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
      <div>
        <label htmlFor="demo-fleetSize" className={labelClassName}>
          Fleet Size (approx. trucks)
        </label>
        <select
          id="demo-fleetSize"
          value={props.fleetSize}
          onChange={(e) => props.setFleetSize(e.target.value)}
          className={selectClassName}
          required
        >
          <option value="">Select fleet size...</option>
          <option value="1-2">1–2 Trucks</option>
          <option value="3-7">3–7 Trucks</option>
          <option value="7-20">7–20 Trucks</option>
          <option value="20-50">20–50 Trucks</option>
        </select>
      </div>
      <div>
        <label htmlFor="demo-message" className={labelClassName}>
          What can we help with?
        </label>
        <textarea
          id="demo-message"
          rows={3}
          value={props.message}
          onChange={(e) => props.setMessage(e.target.value)}
          className={inputClassName}
          placeholder="Tell us about your business and what you're looking for..."
          required
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
          className="mt-1 h-4 w-4 rounded border-slate-500/30 text-brand-primary focus:ring-brand-primary/20"
        />
        <span className="text-xs leading-relaxed text-slate-400">
          I agree to receive text messages from 624 Voice about my inquiry.
          Message and data rates may apply. Reply STOP to opt out.
        </span>
      </label>
      {props.error && (
        <p className="text-sm text-red-400" role="alert">
          {props.error}
        </p>
      )}
      <button
        type="submit"
        disabled={props.loading}
        className="w-full rounded-lg bg-brand-primary px-6 py-3.5 text-sm font-bold text-[#18222f] transition-colors hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {props.loading ? "Submitting…" : "Get Instant Access"}
      </button>
    </form>
  );
}
