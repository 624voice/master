import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { GoogleSchedulingButton } from "~/components/GoogleSchedulingButton";
import appCss from "~/styles/app.css?url";

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
      {
        rel: "stylesheet",
        href: "https://calendar.google.com/calendar/scheduling-button-script.css",
      },
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
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://calendar.google.com/calendar/scheduling-button-script.js",
        async: true,
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
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
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="624 Voice" className="h-9 w-9" />
          <span className="text-lg font-bold text-brand-secondary">
            624 <span className="text-brand-primary">Voice</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-primary"
          >
            Home
          </a>
          <a
            href="/about"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-primary"
          >
            About
          </a>
          <a
            href="/services"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-primary"
          >
            Services
          </a>
          <GoogleSchedulingButton />
        </nav>
        {/* Mobile menu button */}
        <details className="group md:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-gray-600">
            <svg
              className="h-6 w-6"
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
          <div className="absolute left-0 right-0 top-full border-b border-gray-100 bg-white px-6 pb-6 pt-4 shadow-lg">
            <div className="flex flex-col gap-4">
              <a
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-brand-primary"
              >
                Home
              </a>
              <a
                href="/about"
                className="text-sm font-medium text-gray-600 hover:text-brand-primary"
              >
                About
              </a>
              <a
                href="/services"
                className="text-sm font-medium text-gray-600 hover:text-brand-primary"
              >
                Services
              </a>
              <GoogleSchedulingButton />
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
              Helping home services companies answer every call 24/7/365 on the
              first ring — so owners can serve what matters most.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Pages
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="/"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Home
              </a>
              <a
                href="/about"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                About
              </a>
              <a
                href="/services"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Services
              </a>
              <a
                href="/contact"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Contact
              </a>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Contact
            </h4>
            <div className="flex flex-col gap-3 text-sm text-gray-400">
              <span>info@624voice.com</span>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} 624 Voice. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}