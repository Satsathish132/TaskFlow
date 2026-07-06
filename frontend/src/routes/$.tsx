import { createFileRoute } from "@tanstack/react-router";

// Catch-all so every in-app URL resolves; the SPA (mounted in __root) routes it.
export const Route = createFileRoute("/$")({
  component: () => null,
});
