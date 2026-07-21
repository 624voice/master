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
      className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
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
    <div>
      <span className="mb-4 inline-block rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
        The Problem
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-brand-secondary sm:text-3xl">
        Every Missed Call Is a Job You Didn&apos;t Book
      </h2>

      <div className="mt-8 space-y-4">
        {painPoints.map((point) => (
          <div
            key={point}
            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div
              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-gray-600">{point}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-brand-primary">
          What Jessica produces
        </span>
        <ul className="mt-4 space-y-4">
          {outcomes.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <CheckIcon />
              <div>
                <p className="text-sm font-semibold text-brand-secondary">
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
