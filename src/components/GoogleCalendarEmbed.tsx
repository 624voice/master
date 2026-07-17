import { BOOK_MEETING_EMBED_URL } from "~/config/features";

export function GoogleCalendarEmbed({ className = "" }: { className?: string }) {
  return (
    <iframe
      src={BOOK_MEETING_EMBED_URL}
      title="Book a meeting with 624 Voice"
      width="100%"
      height="600"
      className={className}
      style={{ border: 0 }}
    />
  );
}
