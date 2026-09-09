type IconProps = { className?: string };

export function PhoneMissedIcon({ className = "report-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4.5h3l1.2 2.8a1 1 0 0 0 .95.65h2.1a1 1 0 0 1 .98 1.2l-.7 3.5a12 12 0 0 0 5.97 5.97l3.5-.7a1 1 0 0 1 1.2.98v2.1a1 1 0 0 0 .65.95L19.5 21.5v-2"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 4l16 16" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarCheckIcon({ className = "report-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="#10b981" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 14.5l1.8 1.8 3.7-3.7" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendUpIcon({ className = "report-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 18h16" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 14l3-3 3 2 5-6" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 7h-3v3" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessageIcon({ className = "report-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V14a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3V6.5Z"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon({ className = "report-icon" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#10b981" strokeWidth="1.5" />
      <path d="M12 8v4l3 2" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DRIVER_ICONS = {
  missedCallRecovery: PhoneMissedIcon,
  noShowReduction: CalendarCheckIcon,
  outboundSms: MessageIcon,
  jobCloserUpsells: TrendUpIcon,
  timeSavings: ClockIcon,
} as const;

export function DriverIcon({ driverKey }: { driverKey: string }) {
  const Icon = DRIVER_ICONS[driverKey as keyof typeof DRIVER_ICONS] ?? TrendUpIcon;
  return <Icon />;
}
