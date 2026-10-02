import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-32 text-center">
        <h1 className="text-3xl font-bold text-brand-secondary">Page not found</h1>
        <p className="mt-4 max-w-md text-gray-600">
          The page you requested is not available.
        </p>
      </main>
    ),
  });
}
