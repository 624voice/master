const painPoints = [
  "20–40% of home service calls go unanswered. Every one is a job your competitor just booked.",
  "Voicemail doesn't book jobs. Callers hang up and call the next name on Google before the beep ends.",
  "No-shows and late cancellations waste technician time and shrink your day before it starts.",
] as const;

const outcomes = [
  {
    title: "Win more leads by responding immediately",
    description: "First-ring answer 24/7 — before they call anyone else",
  },
  {
    title: "Reduce no-shows and late cancellations",
    description: "Automated SMS and voice confirmations and reminders",
  },
  {
    title: "Reactivate existing customers with ease",
    description:
      "Brings past customers back with automated outbound campaigns",
  },
  {
    title: "Reach every caller in the language they prefer",
    description: "Natively bilingual — handles English and Spanish seamlessly",
  },
  {
    title: "Build recurring revenue on every call",
    description:
      "Care Plan memberships surface naturally — turning one-time jobs into loyal, recurring customers",
  },
] as const;

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function DemoAgentOverview() {
  return (
    <div className="demo-left-col border-b border-slate-400/10 pb-10 lg:border-r lg:border-b-0 lg:pr-9 lg:pb-0">
      <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary">
        No Pitch. No Fluff.
      </p>

      <h1 className="text-[22px] font-extrabold leading-[1.15] text-white">
        What&apos;s Happening to the Calls That Come In While You&apos;re on a
        Job and After Hours?
      </h1>

      <div className="mt-5 mb-5">
        {painPoints.map((point) => (
          <div
            key={point}
            className="flex items-start gap-2.5 border-b border-slate-400/10 py-2.5 last:border-b-0"
          >
            <div
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AF4C0F]"
              aria-hidden="true"
            />
            <p className="m-0 text-[13px] leading-relaxed text-slate-400">
              {point}
            </p>
          </div>
        ))}
      </div>

      <div className="my-4 h-px bg-slate-400/10" />

      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary">
        What Jessica produces for your business
      </p>

      <ul className="space-y-0">
        {outcomes.map((item, index) => (
          <li
            key={item.title}
            className={`flex items-start gap-2.5 py-2.5 ${
              index < outcomes.length - 1
                ? "border-b border-brand-primary/10"
                : ""
            }`}
          >
            <CheckIcon />
            <div>
              <p className="m-0 mb-0.5 text-[13px] font-semibold text-white">
                {item.title}
              </p>
              <p className="m-0 text-[11px] leading-snug text-slate-400">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
