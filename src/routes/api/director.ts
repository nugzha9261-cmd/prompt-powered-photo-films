import { createFileRoute } from "@tanstack/react-router";

import { handleDirectorChat } from "@/lib/director.server";

export const Route = createFileRoute("/api/director")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleDirectorChat(request);
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("AI Director failed", error);
          return new Response("The AI Director couldn't answer. Please try again.", { status: 500 });
        }
      },
    },
  },
});
