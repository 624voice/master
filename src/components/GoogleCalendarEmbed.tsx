import { useEffect, useState } from "react";
import { BOOK_MEETING_EMBED_URL, BOOK_MEETING_URL } from "~/config/features";

export function GoogleCalendarEmbed({ className = "" }: { className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [embedUrl] = useState(() => {
    const tz =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "America/Chicago";
    const separator = BOOK_MEETING_EMBED_URL.includes("?") ? "&" : "?";
    return `${BOOK_MEETING_EMBED_URL}${separator}ctz=${encodeURIComponent(tz)}`;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  if (failed) {
    return (
      <div
        className={`flex min-h-[400px] flex-col items-center justify-center gap-4 px-6 py-12 text-center ${className}`}
        role="status"
      >
        <p className="text-base text-gray-700">
          Having trouble loading the calendar? Open the scheduling page in a new tab.
        </p>
        <a
          href={BOOK_MEETING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-dark"
        >
          Open scheduling page
        </a>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!loaded ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/90"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-brand-secondary">
            Loading available consultation times…
          </p>
        </div>
      ) : null}
      <iframe
        data-testid="google-calendar-embed"
        data-embed-timezone={
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined
        }
        src={embedUrl}
        title="Book a 30-minute AI Growth Systems Consultation with 624 Voice"
        width="100%"
        height="600"
        className="min-h-[600px] w-full"
        style={{ border: 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
