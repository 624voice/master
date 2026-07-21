import {
  CalendarIcon,
  PhoneRingIcon,
  StarIcon,
  VoiceWaveIcon,
} from "~/components/icons";

const demoCapabilities = [
  {
    icon: <PhoneRingIcon className="h-6 w-6" />,
    title: "Answers every call",
    description:
      "Jessica picks up on the first ring — no hold music, no voicemail. Try calling in like a new customer would.",
  },
  {
    icon: <VoiceWaveIcon className="h-6 w-6" />,
    title: "Natural conversation",
    description:
      "She listens, asks follow-up questions, and responds like a trained dispatcher — not a phone tree.",
  },
  {
    icon: <CalendarIcon className="h-6 w-6" />,
    title: "Books & qualifies leads",
    description:
      "Ask about scheduling a service visit, getting an estimate, or what your team can help with today.",
  },
  {
    icon: <StarIcon className="h-6 w-6" />,
    title: "Handles the basics",
    description:
      "Service area, hours, urgency, and common questions — the stuff your office team handles dozens of times a day.",
  },
] as const;

const trySaying = [
  "I need a plumber for a leak under my sink.",
  "Do you serve my area?",
  "Can I book someone for tomorrow morning?",
  "What are your hours?",
] as const;

export function DemoAgentOverview() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-brand-secondary">
          What Jessica can do
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          Jessica is our AI receptionist demo — built for home services
          companies like yours. In a live web call, you&apos;ll hear how 624
          Voice answers real customer questions, captures lead details, and keeps
          the conversation moving toward a booked job.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          One demo call per visitor. You&apos;ll need microphone access and a
          quiet spot for the best experience.
        </p>
      </div>

      <ul className="space-y-4">
        {demoCapabilities.map((item) => (
          <li key={item.title} className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              {item.icon}
            </div>
            <div>
              <h3 className="font-semibold text-brand-secondary">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-6">
        <h3 className="font-semibold text-brand-secondary">
          Try saying something like…
        </h3>
        <ul className="mt-4 space-y-2">
          {trySaying.map((phrase) => (
            <li
              key={phrase}
              className="flex items-start gap-2 text-sm text-brand-secondary"
            >
              <span className="mt-0.5 text-brand-primary" aria-hidden="true">
                →
              </span>
              <span>&ldquo;{phrase}&rdquo;</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
