import { useEffect, useRef } from "react";

const SCHEDULING_SCRIPT_SRC =
  "https://calendar.google.com/calendar/scheduling-button-script.js";

const SCHEDULE_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1CEXxMkoNtwq-TOz0iC57blk5aJVs5XlOA55dp9X0lUmNftEd7p9bJI4cXpD5aMnoUiXqBpoDc?gv=true";

declare global {
  interface Window {
    calendar?: {
      schedulingButton: {
        load: (config: {
          url: string;
          color: string;
          label: string;
          target: HTMLElement;
        }) => void;
      };
    };
  }
}

type GoogleSchedulingButtonProps = {
  label?: string;
  color?: string;
  className?: string;
};

function ensureSchedulingScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.calendar?.schedulingButton) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCHEDULING_SCRIPT_SRC}"]`,
  );

  if (existing) {
    return new Promise((resolve) => {
      if (window.calendar?.schedulingButton) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      const interval = window.setInterval(() => {
        if (window.calendar?.schedulingButton) {
          window.clearInterval(interval);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(interval);
        resolve();
      }, 5000);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCHEDULING_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Calendar scheduling script"));
    document.head.appendChild(script);
  });
}

export function GoogleSchedulingButton({
  label = "Book an appointment",
  color = "#039BE5",
  className,
}: GoogleSchedulingButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const target = targetRef.current;
    if (!wrapper || !target || initializedRef.current) {
      return;
    }

    let cancelled = false;

    ensureSchedulingScript()
      .then(() => {
        if (cancelled || !targetRef.current || initializedRef.current) {
          return;
        }
        if (!window.calendar?.schedulingButton) {
          return;
        }
        initializedRef.current = true;
        window.calendar.schedulingButton.load({
          url: SCHEDULE_URL,
          color,
          label,
          target: targetRef.current,
        });
      })
      .catch(() => {
        // Keep the page usable even if the third-party script fails.
      });

    return () => {
      cancelled = true;
      // Google inserts the button as a sibling of the target; clean it up on unmount.
      if (wrapper) {
        Array.from(wrapper.children).forEach((child) => {
          if (child !== targetRef.current) {
            child.remove();
          }
        });
      }
      initializedRef.current = false;
    };
  }, [color, label]);

  return (
    <div ref={wrapperRef} className={className}>
      <div ref={targetRef} />
    </div>
  );
}
