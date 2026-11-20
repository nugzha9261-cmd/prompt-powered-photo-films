import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Clapperboard, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader, StepLabel } from "@/components/app-header";
import { FinishPanel } from "@/components/finish/finish-panel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MOVIE_MAX_SCENES, MOVIE_MAX_SECONDS, MOVIE_MIN_SCENES, movieLengthOk } from "@/lib/finishing";
import { saveMovie } from "@/lib/finishing.functions";
import { cn } from "@/lib/utils";
import { signedUrls } from "@/lib/video-files";

export const Route = createFileRoute("/_authenticated/movie")({
  head: () => ({
    meta: [
      { title: "Mini-movie maker — CineFlow AI" },
      { name: "description", content: "Join 2 to 6 of your CineFlow AI films into one mini-movie up to 60 seconds." },
      { property: "og:title", content: "Mini-movie maker — CineFlow AI" },
      { property: "og:description", content: "Chain your photo videos into one continuous mini-movie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovieMaker,
});

type Film = { id: string; prompt: string; duration: number; aspect_ratio: string; url: string; path: string };

async function readyFilms(): Promise<Film[]> {
  const { data, error } = await supabase.from("videos")
    .select("id, prompt, duration, aspect_ratio, storage_path")
    .eq("status", "ready").order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  const rows = data.filter((v) => v.storage_path);
  const urls = await signedUrls(rows.map((v) => v.storage_path!));
  return rows.flatMap((v) => urls[v.storage_path!]
    ? [{ id: v.id, prompt: v.prompt, duration: v.duration, aspect_ratio: v.aspect_ratio, url: urls[v.storage_path!]!, path: v.storage_path! }]
    : []);
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the movie."));
    r.readAsDataURL(blob);
  });
}

function MovieMaker() {
  const save = useServerFn(saveMovie);
  const queryClient = useQueryClient();
  const { data: films, isLoading } = useQuery({ queryKey: ["videos", "ready"], queryFn: readyFilms });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; seconds: number } | null>(null);

  const chosen = picked.map((id) => films?.find((f) => f.id === id)).filter((f): f is Film => !!f);
  const total = chosen.reduce((s, f) => s + f.duration, 0);
  const ok = movieLengthOk(chosen.map((f) => f.duration));

  const toggle = (id: string) => {
    setResult(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MOVIE_MAX_SCENES ? p : [...p, id]));
  };
  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const n = [...p];
      const j = i + d;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const make = async () => {
    setResult(null);
    try {
      setBusy("Downloading your scenes…");
      const blobs = await Promise.all(chosen.map((f) => fetch(f.url).then((r) => r.blob())));
      setBusy("Joining scenes… keep this page open");
      const { createVideoProcessor } = await import("@/lib/video-processing");
      const p = await createVideoProcessor();
      let movie: Blob;
      try {
        const tall = chosen[0]!.aspect_ratio === "9:16";
        movie = await p.joinMovie(blobs, tall ? 720 : 1280, tall ? 1280 : 720);
      } finally {
        p.close();
      }
      setBusy("Saving to My films…");
      const { path } = await save({ data: { ids: picked, data: await toBase64(movie) } });
      const urls = await signedUrls([path]);
      setResult({ url: urls[path] ?? URL.createObjectURL(movie), seconds: Math.round(total) });
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Mini-movie saved to My films.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't make the mini-movie.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h1 className="font-display text-5xl leading-[1.02] sm:text-6xl">
            Mini-movie<em className="text-primary">.</em>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Pick {MOVIE_MIN_SCENES}–{MOVIE_MAX_SCENES} of your films in the order they should play — up to {MOVIE_MAX_SECONDS} seconds. Joining is free.
          </p>
          <div className="mt-8">
            <StepLabel n={1}>Choose scenes</StepLabel>
            {isLoading ? (
              <Loader2 className="animate-spin text-primary" />
            ) : !films?.length ? (
              <p className="text-sm text-muted-foreground">
                No finished films yet. <Link to="/studio" className="text-primary hover:underline">Make one in the Studio</Link>.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {films.map((f) => {
                  const n = picked.indexOf(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!!busy}
                      onClick={() => toggle(f.id)}
                      aria-pressed={n >= 0}
                      className={cn("relative overflow-hidden rounded-sm border-2 text-left transition-colors",
                        n >= 0 ? "border-primary" : "border-transparent hover:border-primary/50")}
                    >
                      <video src={f.url} muted playsInline preload="metadata" className="aspect-video w-full bg-muted object-cover" />
                      <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{f.duration}s · {f.prompt}</span>
                      {n >= 0 && (
                        <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {n + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="lg:pt-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <StepLabel n={2}>Order</StepLabel>
            {chosen.length === 0 && <p className="text-sm text-muted-foreground">Tap films on the left to add them.</p>}
            <ol className="space-y-2">
              {chosen.map((f, i) => (
                <li key={f.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <span className="font-display w-5 text-primary">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{f.prompt}</span>
                  <span className="text-xs text-muted-foreground">{f.duration}s</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0 || !!busy} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === chosen.length - 1 || !!busy} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove" disabled={!!busy} onClick={() => toggle(f.id)}><X /></Button>
                </li>
              ))}
            </ol>
            <p className={cn("text-sm", total > MOVIE_MAX_SECONDS ? "text-destructive" : "text-muted-foreground")}>
              Total {Math.round(total)}s of {MOVIE_MAX_SECONDS}s
            </p>
            <Button size="lg" className="h-12 w-full" disabled={!ok || !!busy} onClick={() => void make()}>
              {busy ? <Loader2 className="animate-spin" /> : <Clapperboard />}
              {busy ?? "Make my mini-movie"}
            </Button>
            {result && (
              <>
                <video src={result.url} controls autoPlay playsInline className="w-full rounded-sm bg-muted" />
                <FinishPanel videoUrl={result.url} seconds={result.seconds} name="cineflow-movie" />
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
