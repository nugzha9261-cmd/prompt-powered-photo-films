import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Film, ImagePlus, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getVideoStatus, startVideo } from "@/lib/video.functions";
import {
  ASPECT_RATIOS,
  DURATIONS,
  MAX_PROMPT_LENGTH,
  aspectForSize,
  startVideoSchema,
  type AspectRatio,
  type Duration,
} from "@/lib/video-request";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière — Turn any photo into an AI video" },
      {
        name: "description",
        content:
          "Upload a photo, describe how it should move, and Lumière turns it into a short AI video with sound.",
      },
      { property: "og:title", content: "Lumière — Turn any photo into an AI video" },
      {
        property: "og:description",
        content: "Upload a photo, write a prompt, and watch your still image come to life.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Photo = { base64: string; mime: "image/jpeg"; previewUrl: string; width: number; height: number };
type Phase = "idle" | "starting" | "generating" | "done" | "error";

const IDEAS = [
  "A gentle breeze moves the hair and leaves, slow cinematic push-in, soft ambient wind",
  "The person smiles and turns toward the camera, warm golden-hour light, quiet piano",
  "Waves roll in and the clouds drift by, light flickers on the water, ocean sounds",
  "Snow begins to fall softly, the camera slowly pulls back, calm winter hush",
];

const MAX_SIDE = 1920;

async function preparePhoto(file: File): Promise<Photo> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That photo could not be opened. Try a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process this photo.");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return {
      base64: dataUrl.split(",")[1] ?? "",
      mime: "image/jpeg",
      previewUrl: dataUrl,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Index() {
  const start = useServerFn(startVideo);
  const poll = useServerFn(getVideoStatus);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<Duration>(5);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const busy = phase === "starting" || phase === "generating";

  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(
    () => () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    },
    [],
  );

  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      setAspect(aspectForSize(prepared.width, prepared.height));
      setVideoUrl(null);
      setPhase("idle");
      setError(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That photo could not be used.");
    }
  }, []);

  const fail = (message: string) => {
    setError(message);
    setPhase("error");
  };

  const fetchVideo = async (id: string) => {
    const res = await fetch(`/api/video/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("The video finished but could not be downloaded. Please try again.");
    const blob = await res.blob();
    setVideoUrl(URL.createObjectURL(blob));
    setPhase("done");
  };

  const pollJob = (id: string, transientFailures = 0) => {
    pollTimer.current = setTimeout(async () => {
      if (cancelled.current) return;
      try {
        const result = await poll({ data: { id } });
        if (!result.ok) {
          if (result.transient && transientFailures < 5) {
            return pollJob(id, transientFailures + 1);
          }
          return fail(result.error);
        }
        setProgress(result.progress);
        if (result.status === "completed") {
          await fetchVideo(id);
        } else if (result.status === "failed") {
          const blocked =
            result.errorCode === "moderation_blocked" || result.errorCode === "invalid_request";
          fail(
            (result.error ?? "The video could not be made.") +
              (blocked ? " The photo itself may be the cause — try a different photo." : ""),
          );
        } else {
          pollJob(id, 0);
        }
      } catch (e) {
        if (transientFailures < 5) return pollJob(id, transientFailures + 1);
        fail(e instanceof Error ? e.message : "Lost connection while making your video.");
      }
    }, 6000);
  };

  const generate = async () => {
    if (!photo) return toast.error("Add a photo first.");
    const input = {
      imageBase64: photo.base64,
      mimeType: photo.mime,
      prompt,
      duration,
      aspectRatio: aspect,
    };
    const check = startVideoSchema.safeParse(input);
    if (!check.success) return toast.error(check.error.issues[0]?.message ?? "Check your inputs.");

    setError(null);
    setVideoUrl(null);
    setProgress(null);
    setPhase("starting");
    try {
      const result = await start({ data: check.data });
      if (!result.ok) return fail(result.error);
      setPhase("generating");
      pollJob(result.id);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not start the video.");
    }
  };

  const reset = () => {
    setPhoto(null);
    setVideoUrl(null);
    setPhase("idle");
    setError(null);
    setPrompt("");
  };

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-safelight shadow-[0_0_14px_var(--safelight)]" />
          <span className="font-display text-2xl tracking-wide">Lumière</span>
        </div>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Photo → Motion
        </span>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <section className="flex flex-col">
          <h1 className="font-display text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
            Every photo
            <br />
            <em className="text-primary">wants to move.</em>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Drop in a still, describe what should happen, and we&apos;ll develop it into a short
            video — sound included.
          </p>

          <div className="mt-10 space-y-7">
            <div>
              <StepLabel n={1}>Your photo</StepLabel>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {photo ? (
                <div className="flex items-center gap-4 rounded-md border border-border bg-card p-3">
                  <img
                    src={photo.previewUrl}
                    alt="Your selected photo"
                    className="size-16 rounded-sm object-cover"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">Photo ready</p>
                    <p className="text-muted-foreground">
                      {photo.width} × {photo.height}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove photo"
                    disabled={busy}
                    onClick={reset}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-input bg-card/60 px-6 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
                    dragging && "border-primary bg-accent text-foreground",
                  )}
                >
                  <ImagePlus className="size-6 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">Choose a photo</span> or drop it
                    here
                  </span>
                  <span className="text-xs">JPG, PNG or WebP</span>
                </button>
              )}
            </div>

            <div>
              <StepLabel n={2}>What should happen?</StepLabel>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={MAX_PROMPT_LENGTH}
                rows={4}
                disabled={busy}
                placeholder="e.g. The camera slowly pushes in as wind moves through her hair, soft piano in the background"
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
                    {idea.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-8">
              <div>
                <StepLabel n={3}>Length</StepLabel>
                <Segmented
                  options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                  value={duration}
                  onChange={setDuration}
                  disabled={busy}
                />
              </div>
              <div>
                <StepLabel n={4}>Shape</StepLabel>
                <Segmented
                  options={ASPECT_RATIOS.map((a) => ({
                    value: a,
                    label: a === "16:9" ? "Wide 16:9" : "Tall 9:16",
                  }))}
                  value={aspect}
                  onChange={setAspect}
                  disabled={busy}
                />
              </div>
            </div>

            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              disabled={busy || !photo}
              onClick={generate}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy ? "Developing your video…" : "Bring it to life"}
            </Button>
          </div>
        </section>

        <section aria-live="polite" className="lg:pt-4">
          <div className="sprockets rounded-sm bg-film px-4 py-6 shadow-2xl">
            <div
              className={cn(
                "relative mx-auto flex items-center justify-center overflow-hidden rounded-sm bg-muted",
                aspect === "16:9" ? "aspect-video w-full" : "aspect-[9/16] max-h-[640px]",
              )}
            >
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="size-full object-contain"
                />
              ) : photo ? (
                <>
                  <img
                    src={photo.previewUrl}
                    alt="Photo to animate"
                    className={cn("size-full object-cover", busy && "opacity-50 blur-[1px]")}
                  />
                  {busy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40">
                      <span className="size-3 animate-pulse rounded-full bg-safelight shadow-[0_0_24px_var(--safelight)]" />
                      <p className="font-display text-2xl">Developing…</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(elapsed)} · usually 1–3 minutes
                        {progress != null ? ` · ${Math.round(progress)}%` : ""}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
                  <Film className="size-8 text-primary/70" />
                  <p className="font-display text-2xl text-foreground">Your film appears here</p>
                  <p className="max-w-xs text-sm">Add a photo and a prompt to get started.</p>
                </div>
              )}
            </div>
          </div>

          {phase === "error" && error && (
            <div className="mt-5 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">We couldn&apos;t make this video</p>
              <p className="mt-1 text-foreground/90">{error}</p>
            </div>
          )}

          {phase === "done" && videoUrl && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild>
                <a href={videoUrl} download="lumiere-video.mp4">
                  <Download /> Download video
                </a>
              </Button>
              <Button variant="outline" onClick={generate}>
                <RotateCcw /> Make another version
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Videos aren&apos;t saved — download it to keep it.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
      <span className="font-display text-base normal-case tracking-normal text-primary">{n}</span>
      {children}
    </p>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={disabled}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-sm px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50",
            o.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
