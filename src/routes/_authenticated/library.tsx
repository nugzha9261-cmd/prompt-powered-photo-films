import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Film, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { deleteVideo, downloadVideo, signedUrls } from "@/lib/video-files";
import { syncVideo } from "@/lib/video.functions";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "My films — Lumière" },
      { name: "description", content: "Every AI video you've made with Lumière, saved to your account." },
      { property: "og:title", content: "My films — Lumière" },
      { property: "og:description", content: "Watch, download or delete your saved photo videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

const MODE_LABEL: Record<string, string> = {
  single: "One photo",
  first_last: "First → last",
  storyboard: "Storyboard",
  reference: "Reference",
  edit: "Video edit",
};

async function fetchVideos() {
  const { data, error } = await supabase
    .from("videos")
    .select("id, mode, prompt, duration, aspect_ratio, status, storage_path, poster_path, error, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const paths = data.flatMap((v) => [v.storage_path, v.poster_path].filter((p): p is string => !!p));
  const urls = await signedUrls(paths);
  return data.map((v) => ({
    ...v,
    videoUrl: v.storage_path ? (urls[v.storage_path] ?? null) : null,
    posterUrl: v.poster_path ? (urls[v.poster_path] ?? null) : null,
  }));
}

type VideoItem = Awaited<ReturnType<typeof fetchVideos>>[number];

function Library() {
  const queryClient = useQueryClient();
  const sync = useServerFn(syncVideo);
  const { data: videos, isLoading, error } = useQuery({ queryKey: ["videos"], queryFn: fetchVideos });

  const pendingIds = (videos ?? []).filter((v) => v.status === "generating").map((v) => v.id);
  const pendingKey = pendingIds.join(",");

  // Keep checking videos that are still developing; refresh the list when one finishes.
  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(",");
    const t = setInterval(async () => {
      const results = await Promise.allSettled(ids.map((id) => sync({ data: { id } })));
      const changed = results.some(
        (r) => r.status === "fulfilled" && r.value.ok && r.value.status !== "generating",
      );
      if (changed) void queryClient.invalidateQueries({ queryKey: ["videos"] });
    }, 8000);
    return () => clearInterval(t);
  }, [pendingKey, sync, queryClient]);

  const remove = async (v: VideoItem) => {
    try {
      await deleteVideo(v);
      toast.success("Video deleted.");
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch {
      toast.error("Could not delete this video.");
    }
  };

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl sm:text-6xl">My films</h1>
            <p className="mt-2 text-sm text-muted-foreground">Every video you make is kept here.</p>
          </div>
          <Button asChild>
            <Link to="/studio">
              <Plus /> New video
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-12 text-sm text-destructive">Your films couldn&apos;t be loaded. Refresh to try again.</p>
        ) : !videos?.length ? (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-14 text-center">
            <Film className="size-8 text-primary/70" />
            <p className="font-display text-3xl">No films yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Head to the studio and turn your first photo into a video.
            </p>
            <Button asChild className="mt-2">
              <Link to="/studio">Open the studio</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <article key={v.id} className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
                <div
                  className={cn(
                    "relative flex items-center justify-center bg-film",
                    v.aspect_ratio === "9:16" ? "aspect-[4/5]" : "aspect-video",
                  )}
                >
                  {v.status === "ready" && v.videoUrl ? (
                    <video
                      src={v.videoUrl}
                      poster={v.posterUrl ?? undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="size-full object-contain"
                    />
                  ) : (
                    <>
                      {v.posterUrl && (
                        <img src={v.posterUrl} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
                      )}
                      <div className="relative flex flex-col items-center gap-2 p-4 text-center">
                        {v.status === "generating" ? (
                          <>
                            <span className="size-3 animate-pulse rounded-full bg-safelight shadow-[0_0_24px_var(--safelight)]" />
                            <p className="font-display text-xl">Developing…</p>
                          </>
                        ) : (
                          <>
                            <p className="font-display text-xl text-destructive">Couldn&apos;t be made</p>
                            <p className="line-clamp-3 text-xs text-muted-foreground">{v.error}</p>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="line-clamp-2 text-sm">{v.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {MODE_LABEL[v.mode] ?? v.mode} · {v.duration}s ·{" "}
                    {new Date(v.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <div className="mt-auto flex items-center gap-2">
                    {v.status === "ready" && v.storage_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadVideo(v.storage_path!).catch(() => toast.error("Download failed."))}
                      >
                        <Download /> Download
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="ml-auto" aria-label="Delete video">
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                          <AlertDialogDescription>It will be removed from your account for good.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void remove(v)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
