type DemoHowToStartProps = {
  variant: "gate" | "form" | "hero";
};

export function DemoHowToStart({ variant }: DemoHowToStartProps) {
  if (variant === "hero") {
    return (
      <p className="mt-4 text-base leading-relaxed text-emerald-300/90">
        Click{" "}
        <span className="font-semibold text-white">Get Instant Access</span> on
        the right, then talk to Jessica live in your browser.
      </p>
    );
  }

  if (variant === "form") {
    return (
      <div className="mt-4 rounded-lg border border-brand-primary/20 bg-brand-primary-light/40 p-4">
        <p className="text-sm font-semibold text-brand-secondary">
          To start the demo:
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700">
          <li>Complete every field below</li>
          <li>
            Click{" "}
            <span className="font-semibold text-brand-secondary">
              Get Instant Access
            </span>{" "}
            at the bottom of the form
          </li>
          <li>
            Allow microphone access when prompted — Jessica will answer live
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
      <p className="text-sm font-semibold text-brand-secondary">
        How to start the demo:
      </p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700">
        <li>
          Click{" "}
          <span className="font-semibold text-brand-secondary">
            Get Instant Access
          </span>{" "}
          below
        </li>
        <li>
          Allow microphone access — Jessica answers live in your browser
        </li>
      </ol>
    </div>
  );
}
