import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/roi-calculator")({
  beforeLoad: () => {
    throw redirect({ to: "/assessment" });
  },
  component: () => null,
});
