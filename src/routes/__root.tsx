import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { FEATURE_FLAGS } from "~/config/features";
import appCss from "~/styles/app.css?url";

function NotFoundPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-32 text-center">
      <h1 className="text-3xl font-bold text-brand-secondary">Page not found</h1>
      <p className="mt-4 max-w-md text-gray-600">
        The page you requested is not available. Return home or contact us for help.
      </p>
      <a
        href="/"
        className="mt-8 rounded-[10px] bg-brand-primary px-6 py-3 text-sm font-semibold text-white"
      >
        Back to Home
      </a>
    </main>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "624 Voice — Voice AI for Home Services" },
      {
        name: "description",
        content:
          "624 Voice helps home services companies answer every call 24/7/365 on the first ring. AI receptionist, scheduling, CRM integration, and revenue campaigns.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/logo.png" },
      { rel: "apple-touch-icon", href: "/logo.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Afacad+Flux:wght@400;500;600&family=Comfortaa:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Nav />
        {children}
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}

function Nav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDemoPage = pathname === "/demo";

  const linkClassName = isDemoPage
    ? "text-sm font-medium text-white/80 transition-colors hover:text-[#10b981]"
    : "text-sm font-medium text-gray-600 transition-colors hover:text-brand-primary";

  const demoLinkClassName = isDemoPage
    ? "relative text-sm font-semibold text-[#10b981] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[#10b981] after:content-['']"
    : linkClassName;

  return (
    <header
      className={
        isDemoPage
          ? "fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#152233]/95 backdrop-blur-md"
          : "fixed top-0 left-0 right-0 z-50 border-b border-gray-100/80 bg-white/95 backdrop-blur-md"
      }
    >
      <div className="mx-auto flex max-w-[1450px] items-center justify-between px-6 py-5 lg:px-10">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="624 Voice" className="h-9 w-9" />
          <span
            className={`text-lg font-bold ${
              isDemoPage ? "text-white" : "text-brand-secondary"
            }`}
          >
            624 <span className="text-brand-primary">Voice</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="/what-we-do" className={linkClassName}>
            What We Do
          </a>
          <a href="/how-we-work" className={linkClassName}>
            How We Work
          </a>
          <a href="/demo" className={demoLinkClassName}>
            Live Demo
          </a>
          <a href="/assessment" className={linkClassName}>
            Free Assessment
          </a>
          <a href="/about" className={linkClassName}>
            About
          </a>
          <a
            href="/contact"
            className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-primary-dark"
          >
            Book Your AI Growth Systems Consultation
          </a>
        </nav>
        <details className="group md:hidden">
          <summary
            className={`flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg p-2 ${
              isDemoPage ? "text-white/80" : "text-gray-600"
            }`}
          >
            <svg
              className="h-6 w-6 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                className="group-open:hidden"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                className="hidden group-open:block"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </summary>
          <div
            className={`absolute left-0 right-0 top-full border-b px-6 pb-6 pt-4 shadow-lg ${
              isDemoPage
                ? "border-white/10 bg-[#152233]"
                : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex flex-col gap-1">
              <a href="/what-we-do" className={`${linkClassName} flex min-h-11 items-center rounded-lg px-2 py-2`}>
                What We Do
              </a>
              <a href="/how-we-work" className={`${linkClassName} flex min-h-11 items-center rounded-lg px-2 py-2`}>
                How We Work
              </a>
              <a href="/demo" className={`${demoLinkClassName} flex min-h-11 items-center rounded-lg px-2 py-2`}>
                Live Demo
              </a>
              <a href="/assessment" className={`${linkClassName} flex min-h-11 items-center rounded-lg px-2 py-2`}>
                Free Assessment
              </a>
              <a href="/about" className={`${linkClassName} flex min-h-11 items-center rounded-lg px-2 py-2`}>
                About
              </a>
              <a
                href="/contact"
                className="flex min-h-11 items-center justify-center rounded-[10px] bg-brand-primary px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Book Your AI Growth Systems Consultation
              </a>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-secondary text-gray-400">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="624 Voice" className="h-9 w-9" />
              <span className="text-lg font-bold text-white">
                624 <span className="text-brand-primary">Voice</span>
              </span>
            </a>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-400">
              AI growth systems for home services: get found, respond, convert,
              retain, reduce manual work, and measure what is working.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Pages
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="/what-we-do"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                What We Do
              </a>
              <a
                href="/how-we-work"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                How We Work
              </a>
              <a
                href="/assessment"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Free Assessment
              </a>
              <a
                href="/demo"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Live Demo
              </a>
              <a
                href="/about"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                About
              </a>
              <a
                href="/contact"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Contact
              </a>
              <a
                href="/book"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Book a Time
              </a>
              <a
                href="/privacy"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Terms
              </a>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Contact
            </h4>
            <div className="flex flex-col gap-3 text-sm text-gray-400">
              {FEATURE_FLAGS.SHOW_FOOTER_CONTACT_DETAILS ? (
                <span>info@624voice.com</span>
              ) : (
                <>
                  <a href="/contact" className="transition-colors hover:text-white">
                    Contact us
                  </a>
                  <a href="/book" className="transition-colors hover:text-white">
                    Book a Time
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} 624 Voice. All rights reserved.
            <span className="mx-2">|</span>
            <a
              href="/privacy"
              className="transition-colors hover:text-brand-primary"
            >
              Privacy
            </a>
            <span className="mx-2">|</span>
            <a
              href="/terms"
              className="transition-colors hover:text-brand-primary"
            >
              Terms
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}