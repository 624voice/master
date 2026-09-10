import type { ReactNode } from "react";

type IconProps = { className?: string };

/** Gold-standard v3 handset glyph — solid fill, not diagonal stroke. */
export function PhoneMissedIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 2.5h3l1.5 4-2 1.5a10 10 0 004.5 4.5L11.5 11l4 1.5V15a1.5 1.5 0 01-1.5 1.5A13 13 0 011.5 4 1.5 1.5 0 013 2.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CalendarCheckIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="2" x2="6" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrendUpIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <polyline
        points="2,13 7,7 11,10 16,3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <polyline
        points="12,3 16,3 16,7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function RefreshIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M15 7A6 6 0 103 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <polyline
        points="15,3 15,7 11,7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ClockIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <polyline
        points="9,5 9,9 12,11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ShieldIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path
        d="M22 4L8 10v12c0 8.5 6 16.5 14 19 8-2.5 14-10.5 14-19V10L22 4z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <polyline
        points="16,22 20,26 28,18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
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
  outboundSms: RefreshIcon,
  jobCloserUpsells: TrendUpIcon,
  timeSavings: ClockIcon,
} as const;

export function DriverIcon({
  driverKey,
  size = "md",
  tone = "brand",
}: {
  driverKey: string;
  size?: "sm" | "md";
  tone?: "brand" | "inverse";
}) {
  const Icon = DRIVER_ICONS[driverKey as keyof typeof DRIVER_ICONS] ?? TrendUpIcon;
  return (
    <div
      className={`report-icon-wrap${size === "sm" ? " report-icon-wrap--sm" : ""}${
        tone === "inverse" ? " report-icon-wrap--inverse" : ""
      }`}
    >
      <Icon className={size === "sm" ? "report-icon-svg report-icon-svg--sm" : "report-icon-svg"} />
    </div>
  );
}

export function CapturePillarIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 2a4 4 0 014 4v3a4 4 0 01-8 0V6a4 4 0 014-4z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M3 9a6 6 0 0012 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="9" y1="15" x2="9" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ConvertPillarIcon({ className = "report-icon-svg" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <polyline
        points="3,9 7,13 15,5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function RecoverPillarIcon({ className = "report-icon-svg" }: IconProps) {
  return <RefreshIcon className={className} />;
}

export function ModelInputIcon({ children }: { children: ReactNode }) {
  return <div className="report-icon-wrap report-icon-wrap--sm">{children}</div>;
}
