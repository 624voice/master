import { JessicaCapabilities } from "~/components/DemoJessicaHeading";

type DemoHowToStartProps = {
  variant: "gate" | "form" | "hero";
};

export function DemoHowToStart({ variant }: DemoHowToStartProps) {
  if (variant === "hero") {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-base leading-relaxed text-emerald-300/90">
          Click{" "}
          <span className="font-semibold text-white">Get Instant Access</span>.
        </p>
        <JessicaCapabilities className="text-gray-300" />
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-white/10 p-4">
        <p className="text-sm font-semibold text-white">To start the demo:</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-200">
          <li>Complete every field below</li>
          <li>
            Click{" "}
            <span className="font-semibold text-white">Get Instant Access</span>{" "}
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
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left">
      <p className="text-sm font-semibold text-white">How to start the demo:</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-gray-300">
        <li>
          Click{" "}
          <span className="font-semibold text-white">Get Instant Access</span>{" "}
          below
        </li>
        <li>
          Allow microphone access — Jessica answers live in your browser
        </li>
      </ol>
    </div>
  );
}
