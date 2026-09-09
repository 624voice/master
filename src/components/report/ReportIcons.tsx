import type { ReactNode } from "react";

type IconProps = { className?: string };

export function PhoneMissedIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4.5h3l1.2 2.8a1 1 0 0 0 .95.65h2.1a1 1 0 0 1 .98 1.2l-.7 3.5a12 12 0 0 0 5.97 5.97l3.5-.7a1 1 0 0 1 1.2.98v2.1a1 1 0 0 0 .65.95L19.5 21.5v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarCheckIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9.5 14.5l1.8 1.8 3.7-3.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendUpIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M7 14l3-3 3 2 5-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 7h-3v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MessageIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V14a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3V6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 8v4l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 5 6.5v5.8c0 4.2 2.9 8.1 7 9.2 4.1-1.1 7-5 7-9.2V6.5L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.2 11.2 14l3.8-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircleIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 12.2 10.8 14.5 15.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function DriverIcon({
  driverKey,
  size = "md",
}: {
  driverKey: string;
  size?: "sm" | "md";
}) {
  const Icon = DRIVER_ICONS[driverKey as keyof typeof DRIVER_ICONS] ?? TrendUpIcon;
  return (
    <div className={`report-icon-wrap${size === "sm" ? " report-icon-wrap--sm" : ""}`}>
      <Icon className={size === "sm" ? "report-icon-svg report-icon-svg--sm" : "report-icon-svg"} />
    </div>
  );
}

export function TruckIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8h11v8H3V8Zm11 2h3l2 2v4h-5v-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="17" r="1.5" fill="currentColor" />
      <circle cx="17" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function PhoneIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 4.5h3l1.2 2.8a1 1 0 0 0 .95.65h2.1a1 1 0 0 1 .98 1.2l-.7 3.5a12 12 0 0 0 5.97 5.97l3.5-.7a1 1 0 0 1 1.2.98v2.1a1 1 0 0 0 .65.95L19.5 21.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TradeIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5 12 4l8 5.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DollarIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v16M9.5 7.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 2-2.5 2.2-2.5 2.8-2.5 4 0 2 1.1 2 2.5 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConversionIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function RevenueIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CapturePillarIcon({ className = "report-icon-svg" }: IconProps) {
  return <PhoneIcon className={className} />;
}

export function ConvertPillarIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RecoverPillarIcon({ className = "report-icon-svg" }: IconProps) {
  return <TrendUpIcon className={className} />;
}

export function ModelInputIcon({ children }: { children: ReactNode }) {
  return <div className="report-icon-wrap report-icon-wrap--sm">{children}</div>;
}
