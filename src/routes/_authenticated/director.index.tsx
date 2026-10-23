import { createFileRoute, redirect } from "@tanstack/react-router";

import { latestOrNewThread } from "@/lib/director-threads";

export const Route = createFileRoute("/_authenticated/director/")({
  head: () => ({
    meta: [
      { title: "AI Director — Lumière" },
      { name: "description", content: "Open your latest AI Director chat or start a new one." },
      { property: "og:title", content: "AI Director — Lumière" },
      { property: "og:description", content: "Turn your idea into a ready-to-use video prompt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const thread = latestOrNewThread();
    throw redirect({ to: "/director/$threadId", params: { threadId: thread.id }, replace: true });
  },
  component: () => null,
});
