/** Approved lifecycle visual — diagram-v3-lifecycle.png (owner confirmed v3 final). */
export const LIFECYCLE_DIAGRAM_SRC = "/diagram-v3-lifecycle.png";

export const LIFECYCLE_DIAGRAM_ALT =
  "Customer lifecycle for home services: Get Found, Respond, Convert, Retain and Grow, Reduce Manual Work, and Measure and Improve.";

type CustomerLifecycleDiagramProps = {
  className?: string;
  caption?: string;
};

export function CustomerLifecycleDiagram({
  className = "",
  caption,
}: CustomerLifecycleDiagramProps) {
  return (
    <figure className={className}>
      <img
        src={LIFECYCLE_DIAGRAM_SRC}
        alt={LIFECYCLE_DIAGRAM_ALT}
        className="mx-auto w-full max-w-4xl rounded-xl"
        loading="lazy"
        decoding="async"
      />
      {caption ? (
        <figcaption className="mt-4 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
