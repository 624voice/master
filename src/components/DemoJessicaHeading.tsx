type DemoJessicaHeadingProps = {
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function DemoJessicaHeading({
  className = "",
  titleClassName = "text-xl font-bold text-white sm:text-2xl",
  subtitleClassName = "mt-1 text-sm font-medium text-brand-primary sm:text-base",
}: DemoJessicaHeadingProps) {
  return (
    <div className={`text-center ${className}`}>
      <p className={titleClassName}>Talk to Jessica</p>
      <p className={subtitleClassName}>Live AI Demo</p>
    </div>
  );
}

export function JessicaCapabilities({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm leading-relaxed ${className}`}>
      Have a natural conversation with Jessica in your browser. Ask her anything
      — she can answer FAQs, book appointments, upsell maintenance plans, and
      send confirmations.
    </p>
  );
}
