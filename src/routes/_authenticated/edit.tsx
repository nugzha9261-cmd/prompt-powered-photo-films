import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, Film, Library, Loader2, Scissors, Sparkles, Upload, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader, StepLabel } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  EDIT_MAX_SECONDS,
  EDIT_MIN_SECONDS,
  checkClip,
  editVideoSchema,
  normalizeMime,
  roundDuration,
} from "@/lib/video-edit";
import { downloadVideo, signedUrls } from "@/lib/video-files";
import { MAX_PROMPT_LENGTH, aspectForSize } from "@/lib/video-request";
import { AskDirectorLink } from "@/components/director/ask-director-link";
import { startEdit, syncVideo } from "@/lib/video.functions";

export const Route = createFileRoute("/_authenticated/edit")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string } =>
    typeof search["prompt"] === "string" ? { prompt: search["prompt"].slice(0, MAX_PROMPT_LENGTH) } : {},
  head: () => ({
    meta: [
      { title: "Edit a video — Lumière" },
      { name: "description", content: "Upload a clip, say what to change, and AI edits it while keeping the rest." },
      { property: "og:title", content: "Edit a video — Lumière" },
      { property: "og:description", content: "Change colors, add effects or swap details in your own video clips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPage,
});

type Clip = { file: Blob; url: string; mime: string; seconds: number; width: number; height: number; name: string };
type Phase = "idle" | "starting" | "generating" | "done" | "error";

const IDEAS = [
  "Change the jacket color to bright yellow",
  "Make it snow gently",
  "Turn the scene into night with neon lights",
  "Make it look like a watercolor painting",
];

function readMeta(url: string) {
  return new Promise<{ seconds: number; width: number; height: number }>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      // Some recorded WebM files report Infinity until seeked to the end.
      if (v.duration === Infinity) {
        v.currentTime = 1e9;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          resolve({ seconds: v.duration, width: v.videoWidth, height: v.videoHeight });
        };
      } else resolve({ seconds: v.duration, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => reject(new Error("This video could not be opened. Try an MP4 file."));
    v.src = url;
  });
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("The video could not be read."));
    r.readAsDataURL(blob);
  });
}

function pickRecorderMime() {
  const options = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Plays the chosen part of the clip and records it in the browser, giving a new short clip. */
async function cutClip(src: string, start: number, length: number, onProgress: (p: number) => void) {
  const mime = pickRecorderMime();
  if (!mime) throw new Error("Your browser can't cut videos. Try Chrome, or trim the clip in another app.");
  const v = document.createElement("video");
  v.src = src;
  v.muted = true;
  v.playsInline = true;
  await new Promise((res, rej) => {
    v.onloadeddata = res;
    v.onerror = () => rej(new Error("Could not open the video for cutting."));
  });
  v.currentTime = start;
  await new Promise((res) => (v.onseeked = res));
  const capture = (v as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream });
  const stream = capture.captureStream?.() ?? capture.mozCaptureStream?.();
  if (!stream) throw new Error("Your browser can't cut videos. Try Chrome, or trim the clip in another app.");
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: mime.split(";")[0] ?? mime }))));
  rec.start(250);
  await v.play();
  await new Promise<void>((res) => {
    const tick = () => {
      onProgress(Math.min(1, (v.currentTime - start) / length));
      if (v.currentTime - start >= length || v.ended) return res();
      requestAnimationFrame(tick);
    };
    tick();
  });
  v.pause();
  rec.stop();
  return done;
}

function EditPage() {
  const begin = useServerFn(startEdit);
  const sync = useServerFn(syncVideo);
  const queryClient = useQueryClient();

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimLength, setTrimLength] = useState(EDIT_MAX_SECONDS);
  const [cutting, setCutting] = useState<number | null>(null);
  const search = Route.useSearch();
  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; path: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const busy = phase === "starting" || phase === "generating";

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const checks = clip ? checkClip({ mime: clip.mime, bytes: clip.file.size, seconds: clip.seconds }) : [];
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  const formatOk = checks.find((c) => c.key === "format")?.ok ?? false;
  const needsCut = clip !== null && formatOk && !allOk;

  const loadClip = async (file: Blob, name: string) => {
    setLoading(true);
    try {
      const url = URL.createObjectURL(file);
      const meta = await readMeta(url);
      const mime = file.type || (name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
      setClip((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { file, url, mime, name, ...meta };
      });
      setTrimStart(0);
      setTrimLength(Math.max(EDIT_MIN_SECONDS, Math.min(EDIT_MAX_SECONDS, Math.floor(meta.seconds * 10) / 10)));
      setResult(null);
      setPhase("idle");
      setError(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This video could not be used.");
    } finally {
      setLoading(false);
    }
  };

  const doCut = async () => {
    if (!clip) return;
    setCutting(0);
    try {
      const blob = await cutClip(clip.url, trimStart, trimLength, setCutting);
      await loadClip(blob, `cut.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      toast.success("Part cut out — check the list again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cut the video.");
    } finally {
      setCutting(null);
    }
  };

  const fail = (message: string) => {
    setError(message);
    setPhase("error");
  };

  const pollJob = (id: string, transient = 0) => {
    pollTimer.current = setTimeout(async () => {
      if (cancelled.current) return;
      try {
        const r = await sync({ data: { id } });
        if (!r.ok) {
          if (r.transient && transient < 5) return pollJob(id, transient + 1);
          return fail(r.error);
        }
        setProgress(r.progress);
        if (r.status === "ready" && r.storagePath) {
          const urls = await signedUrls([r.storagePath]);
          setResult({ url: urls[r.storagePath]!, path: r.storagePath });
          setPhase("done");
          void queryClient.invalidateQueries({ queryKey: ["videos"] });
        } else if (r.status === "failed") fail(r.error ?? "The edit could not be made.");
        else pollJob(id, 0);
      } catch (e) {
        if (transient < 5) return pollJob(id, transient + 1);
        fail(e instanceof Error ? e.message : "Lost connection while editing your video.");
      }
    }, 6000);
  };

  const generate = async () => {
    if (!clip || !allOk) return;
    setPhase("starting");
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const data = {
        video: { data: await toBase64(clip.file), mimeType: normalizeMime(clip.mime)! },
        seconds: roundDuration(clip.seconds),
        prompt,
        aspectRatio: aspectForSize(clip.width, clip.height),
      };
      const check = editVideoSchema.safeParse(data);
      if (!check.success) {
        setPhase("idle");
        return toast.error(check.error.issues[0]?.message ?? "Check your inputs.");
      }
      const r = await begin({ data: check.data });
      if (!r.ok) return fail(r.error);
      setPhase("generating");
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      pollJob(r.id);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not start the edit.");
    }
  };

  const maxStart = clip ? Math.max(0, roundDuration(clip.seconds - trimLength)) : 0;

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <section className="flex flex-col">
          <h1 className="font-display text-5xl leading-[1.02] sm:text-6xl">
            Edit a video<em className="text-primary">.</em>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Add a clip, say what should change, and the rest stays the same. We check every rule for
            you before anything is sent.
          </p>

          <div className="mt-9 space-y-7">
            <div>
              <StepLabel n={1}>Your clip</StepLabel>
              <input
                ref={input}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                aria-label="Video file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadClip(f, f.name);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={busy || loading} onClick={() => input.current?.click()}>
                  {loading ? <Loader2 className="animate-spin" /> : <Upload />} Upload a video
                </Button>
                <Button variant="outline" disabled={busy || loading} onClick={() => setShowLibrary((s) => !s)}>
                  <Library /> From My films
                </Button>
              </div>
              {showLibrary && (
                <LibraryPicker
                  onPick={async (path) => {
                    setShowLibrary(false);
                    setLoading(true);
                    try {
                      const url = (await signedUrls([path]))[path];
                      const blob = await (await fetch(url!)).blob();
                      await loadClip(new Blob([blob], { type: "video/mp4" }), "film.mp4");
                    } catch {
                      toast.error("Could not load that film.");
                      setLoading(false);
                    }
                  }}
                />
              )}
            </div>

            {clip && (
              <div>
                <StepLabel n={2}>Checklist</StepLabel>
                <ul className="space-y-1.5 rounded-md border border-border bg-card p-3">
                  {checks.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-sm">
                      {c.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-destructive" />
                      )}
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground">— {c.detail}</span>
                    </li>
                  ))}
                  {allOk && (
                    <li className="pt-1 text-xs text-muted-foreground">
                      All good. The edit will be exactly {roundDuration(clip.seconds)}s, matching your clip.
                    </li>
                  )}
                </ul>

                {needsCut && (
                  <div className="mt-3 space-y-4 rounded-md border border-primary/50 bg-accent p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Scissors className="size-4 text-primary" /> Pick the part to edit
                    </p>
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Starts at {trimStart.toFixed(1)}s · ends at {(trimStart + trimLength).toFixed(1)}s
                      </p>
                      <Slider
                        min={0}
                        max={maxStart}
                        step={0.1}
                        value={[Math.min(trimStart, maxStart)]}
                        onValueChange={([v]) => setTrimStart(v ?? 0)}
                        disabled={cutting !== null || maxStart === 0}
                        aria-label="Start time"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Length: {trimLength.toFixed(1)}s</p>
                      <Slider
                        min={EDIT_MIN_SECONDS}
                        max={Math.min(EDIT_MAX_SECONDS, Math.floor(clip.seconds * 10) / 10)}
                        step={0.1}
                        value={[trimLength]}
                        onValueChange={([v]) => {
                          const len = v ?? EDIT_MAX_SECONDS;
                          setTrimLength(len);
                          setTrimStart((s) => Math.min(s, Math.max(0, roundDuration(clip.seconds - len))));
                        }}
                        disabled={cutting !== null}
                        aria-label="Length"
                      />
                    </div>
                    <Button onClick={doCut} disabled={cutting !== null || clip.seconds < EDIT_MIN_SECONDS}>
                      {cutting !== null ? <Loader2 className="animate-spin" /> : <Scissors />}
                      {cutting !== null ? `Cutting… ${Math.round(cutting * 100)}%` : "Cut this part"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Cutting plays the part once in real time, so it takes as long as the part itself.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <StepLabel n={3}>What should change?</StepLabel>
                <AskDirectorLink />
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={MAX_PROMPT_LENGTH}
                rows={3}
                disabled={busy}
                placeholder="e.g. Change the red car to a vintage blue convertible"
                className="resize-none bg-card text-base"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    disabled={busy}
                    onClick={() => setPrompt(idea)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Tip: ask for one change at a time. Motion, timing and camera stay the same.
              </p>
            </div>

            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              disabled={busy || !allOk || prompt.trim().length < 3}
              onClick={generate}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy ? "Editing your video…" : !clip ? "Add a clip first" : !allOk ? "Fix the checklist first" : "Edit my video"}
            </Button>
          </div>
        </section>

        <section aria-live="polite" className="lg:pt-4">
          <div className="sprockets rounded-sm bg-film px-4 py-6 shadow-2xl lg:sticky lg:top-6">
            <div className="relative mx-auto flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm bg-muted">
              {result ? (
                <video src={result.url} controls autoPlay loop playsInline className="size-full object-contain" />
              ) : clip ? (
                <>
                  <video
                    src={clip.url}
                    controls={!busy}
                    muted
                    playsInline
                    className={cn("size-full object-contain", busy && "opacity-50")}
                  />
                  {busy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40">
                      <span className="size-3 animate-pulse rounded-full bg-safelight shadow-[0_0_24px_var(--safelight)]" />
                      <p className="font-display text-2xl">Developing…</p>
                      <p className="text-xs text-muted-foreground">
                        usually 1–3 minutes{progress != null ? ` · ${Math.round(progress)}%` : ""}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
                  <Film className="size-8 text-primary/70" />
                  <p className="font-display text-2xl text-foreground">Your edit appears here</p>
                  <p className="max-w-xs text-sm">MP4, WebM or MOV · 3–10 seconds · up to 40 MB</p>
                </div>
              )}
            </div>
          </div>

          {busy && (
            <p className="mt-4 text-xs text-muted-foreground">
              You can leave this page — the edit keeps developing and appears in My films.
            </p>
          )}
          {phase === "error" && error && (
            <div className="mt-5 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">We couldn&apos;t edit this video</p>
              <p className="mt-1 text-foreground/90">{error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Note: editing uploaded clips isn&apos;t available in the UK, EU and Switzerland.
              </p>
            </div>
          )}
          {phase === "done" && result && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => void downloadVideo(result.path).catch(() => toast.error("Download failed."))}>
                <Download /> Download
              </Button>
              <Button asChild variant="ghost">
                <Link to="/library">See all my films</Link>
              </Button>
              <p className="w-full text-xs text-muted-foreground">Saved to your account.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LibraryPicker({ onPick }: { onPick: (path: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["videos", "pickable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, prompt, storage_path, poster_path")
        .eq("status", "ready")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const posters = await signedUrls(data.map((v) => v.poster_path).filter((p): p is string => !!p));
      return data.map((v) => ({ ...v, poster: v.poster_path ? posters[v.poster_path] : undefined }));
    },
  });
  if (isLoading) return <p className="mt-3 text-sm text-muted-foreground">Loading your films…</p>;
  if (!data?.length) return <p className="mt-3 text-sm text-muted-foreground">No finished films yet.</p>;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {data.map((v) => (
        <button
          key={v.id}
          type="button"
          title={v.prompt}
          onClick={() => onPick(v.storage_path!)}
          className="flex aspect-video items-center justify-center overflow-hidden rounded-sm border border-border bg-card hover:border-primary"
        >
          {v.poster ? (
            <img src={v.poster} alt={v.prompt} className="size-full object-cover" />
          ) : (
            <span className="line-clamp-3 p-1 text-[10px] text-muted-foreground">{v.prompt}</span>
          )}
        </button>
      ))}
    </div>
  );
}
