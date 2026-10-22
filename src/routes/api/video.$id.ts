import { createFileRoute } from "@tanstack/react-router";

import { VIDEO_ID_PATTERN } from "@/lib/video-request";

// Streams a finished clip's MP4 to the browser (the gateway link is short-lived).
export const Route = createFileRoute("/api/video/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!VIDEO_ID_PATTERN.test(params.id)) {
          return new Response("Invalid video id", { status: 400 });
        }
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Not configured", { status: 500 });

        const upstream = await fetch(
          `https://ai.gateway.lovable.dev/v1/videos/${encodeURIComponent(params.id)}/content`,
          { headers: { Authorization: `Bearer ${key}` } },
        );
        if (!upstream.ok || !upstream.body) {
          console.error("Video download failed", upstream.status);
          return new Response("Video not available", { status: upstream.status || 502 });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
