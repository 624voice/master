type DemoHowToStartProps = {
  variant: "form" | "demo";
};

export function DemoHowToStart({ variant }: DemoHowToStartProps) {
  if (variant === "demo") {
    return (
      <p className="mb-4 text-center text-sm leading-relaxed text-gray-600">
        Tap the{" "}
        <span className="font-semibold text-brand-secondary">microphone</span>{" "}
        and allow access when your browser prompts you.
      </p>
    );
  }

  return (
    <p className="mt-2 text-center text-sm text-gray-600">
      A few quick details, then you&apos;ll connect live with Jessica.
    </p>
  );
}
