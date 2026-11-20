import { Link, Outlet, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";

import directorMark from "@/assets/director-mark.png";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  deleteThread,
  listThreads,
  startThread,
  subscribeThreads,
  type DirectorThread,
} from "@/lib/director-threads";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/director")({
  head: () => ({
    meta: [
      { title: "AI Director — CineFlow AI" },
      { name: "description", content: "Chat with the AI Director to turn your idea into a ready-to-use video prompt." },
      { property: "og:title", content: "AI Director — CineFlow AI" },
      { property: "og:description", content: "Describe your idea in plain words and get a cinematic prompt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectorLayout,
});

const NO_THREADS: DirectorThread[] = [];

function DirectorLayout() {
  const threads = useSyncExternalStore(subscribeThreads, listThreads, () => NO_THREADS);
  const params = useParams({ strict: false }) as { threadId?: string };
  const navigate = useNavigate();

  const newChat = () => {
    const t = startThread();
    void navigate({ to: "/director/$threadId", params: { threadId: t.id } });
  };

  const remove = (id: string) => {
    deleteThread(id);
    if (id === params.threadId) void navigate({ to: "/director", replace: true });
  };

  return (
    <div className="grain flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 pb-6 pt-6 sm:px-6 lg:grid-cols-[250px_1fr] lg:gap-6">
        <aside className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src={directorMark} alt="AI Director" width={32} height={32} className="size-8 rounded-full bg-foreground p-0.5" />
              <span className="font-display text-2xl">AI Director</span>
            </div>
            <Button size="sm" variant="outline" onClick={newChat}>
              <MessageSquarePlus /> New chat
            </Button>
          </div>
          <p className="hidden text-xs text-muted-foreground lg:block">
            Chats are kept on this device only.
          </p>
          <nav aria-label="Your chats" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex shrink-0 items-center rounded-md border text-sm transition-colors lg:shrink",
                  t.id === params.threadId
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:border-primary/60",
                )}
              >
                <Link
                  to="/director/$threadId"
                  params={{ threadId: t.id }}
                  className="min-w-0 max-w-[14rem] flex-1 truncate px-3 py-2 lg:max-w-none"
                  title={t.title}
                >
                  {t.title}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label={`Delete chat “${t.title}”`}
                  className="mr-1 rounded-sm p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </nav>
        </aside>

        <section className="flex h-[calc(100dvh-13rem)] min-h-[460px] flex-col overflow-hidden rounded-md border border-border bg-card lg:h-[calc(100dvh-8.5rem)]">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
