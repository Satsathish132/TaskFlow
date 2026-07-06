import { createFileRoute } from "@tanstack/react-router";

// The Taskflow SPA is mounted once in __root; page routes render nothing.
export const Route = createFileRoute("/")({
  component: () => null,
});
