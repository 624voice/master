import { createFileRoute } from "@tanstack/react-router";
import { deployVersionJson, publicHealthJson, shouldExposeDetailedHealth } from "~/server/deployVersion";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const body = shouldExposeDetailedHealth() ? deployVersionJson() : publicHealthJson();
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
