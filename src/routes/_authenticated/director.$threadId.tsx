import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { DirectorChat } from "@/components/director/director-chat";
import { Button } from "@/components/ui/button";
import { getThread } from "@/lib/director-threads";

export const Route = createFileRoute("/_authenticated/director/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — AI Director — Lumière" },
      { name: "description", content: "Your conversation with the AI Director about your next video." },
      { property: "og:title", content: "AI Director chat — Lumière" },
      { property: "og:description", content: "Work out the perfect prompt for your photo video." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  // Read once per chat; the chat itself owns messages after that.
  const thread = useMemo(() => getThread(threadId), [threadId]);

  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-display text-3xl">This chat isn&apos;t on this device</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          AI Director chats are kept on the device where they started, or it may have been deleted.
        </p>
        <Button asChild variant="outline">
          <Link to="/director">Open my chats</Link>
        </Button>
      </div>
    );
  }

  return <DirectorChat key={threadId} threadId={threadId} initialMessages={thread.messages} />;
}
