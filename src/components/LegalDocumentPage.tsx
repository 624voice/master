export type LegalBlock =
  | { type: "paragraph"; text: string; callout?: boolean }
  | { type: "sample"; label: string; text: string };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
  subsections?: { heading: string; blocks: LegalBlock[] }[];
};

export type LegalDocument = {
  title: string;
  badge: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
};

function linkify(text: string) {
  const parts = text.split(/(info@624voice\.com|624voice\.com)/g);
  return parts.map((part, i) => {
    if (part === "info@624voice.com") {
      return (
        <a
          key={i}
          href="mailto:info@624voice.com"
          className="font-medium text-brand-primary hover:text-brand-primary-dark"
        >
          info@624voice.com
        </a>
      );
    }
    if (part === "624voice.com") {
      return (
        <a
          key={i}
          href="https://624voice.com"
          className="font-medium text-brand-primary hover:text-brand-primary-dark"
        >
          624voice.com
        </a>
      );
    }
    return part;
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "sample") {
    return (
      <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
          {block.label}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-brand-secondary">
          {linkify(block.text)}
        </p>
      </div>
    );
  }

  if (block.callout) {
    return (
      <p className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-light/60 p-4 text-sm font-semibold leading-relaxed text-brand-secondary">
        {linkify(block.text)}
      </p>
    );
  }

  return (
    <p className="mt-4 text-base leading-relaxed text-gray-700">
      {linkify(block.text)}
    </p>
  );
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            {document.badge}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {document.title}
          </h1>
          <p className="mt-6 text-sm text-gray-400">
            624voice.com — Effective Date: {document.effectiveDate}
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          {document.sections.map((section) => (
            <article key={section.heading} className="mb-12 last:mb-0">
              <h2 className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
                {section.heading}
              </h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
              {section.subsections?.map((sub) => (
                <div key={sub.heading} className="mt-8">
                  <h3 className="text-lg font-semibold text-brand-secondary">
                    {sub.heading}
                  </h3>
                  {sub.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              ))}
            </article>
          ))}

          <p className="mt-16 border-t border-gray-200 pt-8 text-sm text-gray-500">
            {document.lastUpdated}
          </p>
        </div>
      </section>
    </main>
  );
}
