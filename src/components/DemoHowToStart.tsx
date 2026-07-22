type DemoHowToStartProps = {
  variant: "form" | "hero" | "demo";
};

export function DemoHowToStart({ variant }: DemoHowToStartProps) {
  if (variant === "hero") {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-base leading-relaxed text-emerald-300/90">
          Fill out the form to unlock the demo, then click{" "}
          <span className="font-semibold text-white">Start conversation</span>.
        </p>
      </div>
    );
  }

  if (variant === "demo") {
    return (
      <p className="text-sm leading-relaxed text-gray-300">
        Your info is saved. Click{" "}
        <span className="font-semibold text-white">Start conversation</span>{" "}
        below and allow microphone access when prompted.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-500/20 bg-white/10 p-4">
      <p className="text-sm font-semibold text-white">To start the demo:</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-200">
        <li>Complete every field below</li>
        <li>
          Click{" "}
          <span className="font-semibold text-white">Continue to demo</span>
        </li>
        <li>
          Click <span className="font-semibold text-white">Start conversation</span>{" "}
          and allow microphone access
        </li>
      </ol>
    </div>
  );
}
