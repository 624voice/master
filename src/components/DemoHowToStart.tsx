import { JessicaCapabilities } from "~/components/DemoJessicaHeading";

type DemoHowToStartProps = {
  variant: "gate" | "form" | "hero" | "demo";
};

export function DemoHowToStart({ variant }: DemoHowToStartProps) {
  if (variant === "hero") {
    return (
      <div className="mt-3 hidden lg:block">
        <JessicaCapabilities className="text-sm text-gray-300" />
      </div>
    );
  }

  if (variant === "gate") {
    return null;
  }

  if (variant === "demo") {
    return (
      <p className="mb-3 text-sm leading-relaxed text-gray-300">
        Click{" "}
        <span className="font-semibold text-white">Start conversation</span>{" "}
        and allow microphone access when prompted.
      </p>
    );
  }

  return (
    <p className="mt-2 text-sm text-gray-300">
      A few quick details, then you&apos;ll connect live with Jessica.
    </p>
  );
}
