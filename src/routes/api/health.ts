import { createFileRoute } from "@tanstack/react-router";
import { deployVersionJson } from "~/server/deployVersion";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        new Response(deployVersionJson(), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }),
    },
  },
});
