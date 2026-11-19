import { creditsKey, openPaywall } from "@/hooks/use-credits";
import { OUT_OF_CREDITS } from "@/lib/credits";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Download,
  Film,
  GalleryHorizontal,
  ImageIcon,
  ImagePlus,
  Loader2,
  Music,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader, StepLabel } from "@/components/app-header";
import { AskDirectorLink } from "@/components/director/ask-director-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { preparePhoto, type Photo } from "@/lib/photo";
import { cn } from "@/lib/utils";
import { MUSIC_TRACKS } from "@/lib/music";
import { STYLE_TEMPLATES } from "@/lib/templates";
import { downloadVideo, signedUrls } from "@/lib/video-files";
import { startVideo, syncVideo } from "@/lib/video.functions";
import {
  ASPECT_RATIOS,
  DURATIONS,
  MAX_CAPTION_LENGTH,
  MAX_PROMPT_LENGTH,
  MODE_LIMITS,
  aspectForSize,
  startVideoSchema,
  type AspectRatio,
  type Duration,
  type Mode,
} from "@/lib/video-request";

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string } =>
    typeof search["prompt"] === "string" ? { prompt: search["prompt"].slice(0, MAX_PROMPT_LENGTH) } : {},
  head: () => ({
    meta: [
      { title: "Studio — Lumière" },
      { name: "description", content: "Turn one or more photos into an AI video and save it to your account." },
      { property: "og:title", content: "Studio — Lumière" },
      { property: "og:description", content: "Animate a photo, morph first to last scene, or build a storyboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

type Slot = { photo: Photo | null; caption: string };
type Phase = "idle" | "starting" | "generating" | "done" | "error";

const MODE_INFO: Record<Mode, { label: string; hint: string; icon: typeof ImageIcon }> = {
  single: { label: "One photo", hint: "Bring a single still to life.", icon: ImageIcon },
  first_last: { label: "First → last", hint: "Start on one photo, end on another.", icon: ArrowRight },
  storyboard: { label: "Storyboard", hint: "First scene, middle scenes, last scene.", icon: GalleryHorizontal },
  reference: { label: "Reference", hint: "Put people or things from photos into a new scene.", icon: Users },
};

const IDEAS: Record<Mode, string[]> = {
  single: [
    "A gentle breeze moves the hair and leaves, slow cinematic push-in, soft ambient wind",
    "The person smiles and turns toward the camera, warm golden-hour light, quiet piano",
    "Waves roll in and the clouds drift by, light flickers on the water, ocean sounds",
  ],
  first_last: [
    "A slow, dreamy camera glide from the first place to the second, soft strings",
    "Day turns to night as the camera drifts forward, city hum fading to crickets",
  ],
  storyboard: [
    "A warm travel montage, smooth camera moves between scenes, upbeat acoustic guitar",
    "A cinematic journey with slow dissolves, gentle orchestral music",
  ],
  reference: [
    "They walk together along a sunny beach at golden hour, waves and laughter",
    "Placed on a marble table in a bright studio, the camera circles slowly, soft music",
  ],
};

function slotLabel(mode: Mode, i: number, count: number) {
  if (mode === "single") return "Your photo";
  if (mode === "reference") return `Reference ${i + 1}`;
  if (i === 0) return "First scene";
  if (i === count - 1) return "Last scene";
  return `Scene ${i + 1}`;
}

function resizeSlots(slots: Slot[], mode: Mode): Slot[] {
  const { min, max } = MODE_LIMITS[mode];
  const target = mode === "storyboard" ? Math.min(Math.max(slots.length, 3), max) : Math.min(Math.max(slots.length, min), max);
  const next = slots.slice(0, target);
  while (next.length < target) next.push({ photo: null, caption: "" });
  return next;
}

function Studio() {
  const start = useServerFn(startVideo);
  const sync = useServerFn(syncVideo);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("single");
  const [slots, setSlots] = useState<Slot[]>([{ photo: null, caption: "" }]);
  const search = Route.useSearch();
  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [duration, setDuration] = useState<Duration>(5);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; path: string } | null>(null);

  const [template, setTemplate] = useState<string | null>(null);
  const [track, setTrack] = useState<string>(MUSIC_TRACKS[0]!.id);
  const [scoring, setScoring] = useState(false);

  const downloadWithMusic = async () => {
    if (!result) return;
    setScoring(true);
    try {
      const t = MUSIC_TRACKS.find((m) => m.id === track)!;
      const [video, music] = await Promise.all([
        fetch(result.url).then((r) => r.blob()),
        fetch(t.src).then((r) => r.blob()),
      ]);
      const { createVideoProcessor } = await import("@/lib/video-processing");
      const processor = await createVideoProcessor();
      try {
        const out = await processor.addMusic(video, music, duration);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(out);
        a.download = `lumiere-${t.id}.mp4`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      } finally {
        processor.close();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add music.");
    } finally {
      setScoring(false);
    }
  };

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const busy = phase === "starting" || phase === "generating";
  const firstPhoto = slots.find((s) => s.photo)?.photo ?? null;

  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const changeMode = (m: Mode) => {
    setMode(m);
    setSlots((s) => resizeSlots(s, m));
    setPhase("idle");
    setError(null);
  };

  const setSlotPhoto = useCallback(
    async (index: number, file: File | undefined) => {
      if (!file) return;
      try {
        const photo = await preparePhoto(file);
        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, photo } : s)));
        if (index === 0 && mode !== "reference") setAspect(aspectForSize(photo.width, photo.height));
        setPhase("idle");
        setError(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That photo could not be used.");
      }
    },
    [mode],
  );

  const clearSlot = (index: number) =>
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, photo: null } : s)));

  const addSlot = () =>
    setSlots((prev) => {
      if (prev.length >= MODE_LIMITS[mode].max) return prev;
      const blank = { photo: null, caption: "" };
      // Storyboards add scenes before the last scene.
      return mode === "storyboard" ? [...prev.slice(0, -1), blank, prev[prev.length - 1]!] : [...prev, blank];
    });

  const removeSlot = (index: number) =>
    setSlots((prev) => (prev.length <= MODE_LIMITS[mode].min ? prev : prev.filter((_, i) => i !== index)));

  const fail = (message: string) => {
    setError(message);
    setPhase("error");
  };

  const finish = async (path: string) => {
    const urls = await signedUrls([path]);
    const url = urls[path];
    if (!url) throw new Error("Your video was saved, but couldn't be loaded. Find it in My films.");
    setResult({ url, path });
    setPhase("done");
    void queryClient.invalidateQueries({ queryKey: ["videos"] });
  };

  const pollJob = (id: string, transientFailures = 0) => {
    pollTimer.current = setTimeout(async () => {
      if (cancelled.current) return;
      try {
        const r = await sync({ data: { id } });
        if (!r.ok) {
          if (r.transient && transientFailures < 5) return pollJob(id, transientFailures + 1);
          return fail(r.error);
        }
        setProgress(r.progress);
        if (r.status === "ready" && r.storagePath) await finish(r.storagePath);
        else if (r.status === "failed") fail(r.error ?? "The video could not be made.");
        else pollJob(id, 0);
      } catch (e) {
        if (transientFailures < 5) return pollJob(id, transientFailures + 1);
        fail(e instanceof Error ? e.message : "Lost connection while making your video.");
      }
    }, 6000);
  };

  const generate = async () => {
    const filled = slots.filter((s) => s.photo);
    if (filled.length !== slots.length) {
      return toast.error(`Add a photo for every slot (${slots.length - filled.length} missing).`);
    }
    const input = {
      mode,
      images: slots.map((s) => ({
        data: s.photo!.base64,
        mimeType: s.photo!.mime,
        caption: mode === "storyboard" && s.caption.trim() ? s.caption : undefined,
      })),
      prompt,
      duration,
      aspectRatio: aspect,
    };
    const check = startVideoSchema.safeParse(input);
    if (!check.success) return toast.error(check.error.issues[0]?.message ?? "Check your inputs.");

    setError(null);
    setResult(null);
    setProgress(null);
    setPhase("starting");
    try {
      const r = await start({ data: check.data });
      void queryClient.invalidateQueries({ queryKey: creditsKey });
      if (!r.ok) {
        if ("code" in r && r.code === OUT_OF_CREDITS) openPaywall();
        return fail(r.error);
      }
      setPhase("generating");
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      pollJob(r.id);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Could not start the video.");
    }
  };

  const canAdd = slots.length < MODE_LIMITS[mode].max && (mode === "storyboard" || mode === "reference");

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <section className="flex flex-col">
          <h1 className="font-display text-5xl leading-[1.02] sm:text-6xl">
            The studio<em className="text-primary">.</em>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Pick how your photos should be used, describe the motion, and every finished video is
            saved to <Link to="/library" className="text-primary hover:underline">My films</Link>.
          </p>

          <div className="mt-9 space-y-7">
            <div>
              <StepLabel n={1}>How to use your photos</StepLabel>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MODE_INFO) as Mode[]).map((m) => {
                  const { label, hint, icon: Icon } = MODE_INFO[m];
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={busy}
                      aria-pressed={mode === m}
                      onClick={() => changeMode(m)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors disabled:opacity-50",
                        mode === m
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:border-primary/60",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4 text-primary" /> {label}
                      </span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <StepLabel n={2}>{slots.length > 1 ? "Your photos" : "Your photo"}</StepLabel>
              <div className="space-y-2.5">
                {slots.map((slot, i) => (
                  <PhotoSlot
                    key={i}
                    label={slotLabel(mode, i, slots.length)}
                    slot={slot}
                    disabled={busy}
                    showCaption={mode === "storyboard"}
                    removable={
                      slots.length > MODE_LIMITS[mode].min &&
                      (mode === "reference" || (mode === "storyboard" && i > 0 && i < slots.length - 1))
                    }
                    onFile={(f) => void setSlotPhoto(i, f)}
                    onClear={() => clearSlot(i)}
                    onRemove={() => removeSlot(i)}
                    onCaption={(caption) =>
                      setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, caption } : s)))
                    }
                  />
                ))}
                {canAdd && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={addSlot}>
                    <Plus /> {mode === "storyboard" ? "Add a middle scene" : "Add another reference"}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <StepLabel n={3}>What should happen?</StepLabel>
                <AskDirectorLink />
              </div>
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {STYLE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={template === t.id}
                    onClick={() => {
                      setTemplate(t.id);
                      setPrompt(t.prompt);
                      setDuration(t.duration);
                    }}
                    className={cn(
                      "flex w-36 shrink-0 flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors disabled:opacity-50",
                      template === t.id ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60",
                    )}
                  >
                    <span className="text-sm font-medium leading-tight">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.hint}</span>
                  </button>
                ))}
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setTemplate(null);
                }}
                maxLength={MAX_PROMPT_LENGTH}
                rows={4}
                disabled={busy}
                placeholder={
                  mode === "reference"
                    ? "e.g. The two of them dance in the rain on a city street at night, jazz music"
                    : "e.g. The camera slowly pushes in as wind moves through her hair, soft piano in the background"
                }
                className="resize-none bg-card text-base"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {IDEAS[mode].map((idea) => (
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
                <StepLabel n={4}>Length</StepLabel>
                <Segmented
                  options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                  value={duration}
                  onChange={setDuration}
                  disabled={busy}
                />
              </div>
              <div>
                <StepLabel n={5}>Shape</StepLabel>
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
              disabled={busy || !firstPhoto}
              onClick={generate}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy ? "Developing your video…" : "Bring it to life"}
            </Button>
          </div>
        </section>

        <section aria-live="polite" className="lg:pt-4">
          <div className="sprockets rounded-sm bg-film px-4 py-6 shadow-2xl lg:sticky lg:top-6">
            <div
              className={cn(
                "relative mx-auto flex items-center justify-center overflow-hidden rounded-sm bg-muted",
                aspect === "16:9" ? "aspect-video w-full" : "aspect-[9/16] max-h-[640px]",
              )}
            >
              {result ? (
                <video src={result.url} controls autoPlay loop playsInline className="size-full object-contain" />
              ) : firstPhoto ? (
                <>
                  <img
                    src={firstPhoto.previewUrl}
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
                  <p className="max-w-xs text-sm">Add your photos and a prompt to get started.</p>
                </div>
              )}
            </div>
            {slots.filter((s) => s.photo).length > 1 && !result && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {slots.map((s, i) =>
                  s.photo ? (
                    <img
                      key={i}
                      src={s.photo.previewUrl}
                      alt={slotLabel(mode, i, slots.length)}
                      title={slotLabel(mode, i, slots.length)}
                      className="h-12 w-auto rounded-sm opacity-80"
                    />
                  ) : null,
                )}
              </div>
            )}
          </div>

          {busy && (
            <p className="mt-4 text-xs text-muted-foreground">
              You can leave this page — the video will keep developing and appear in My films.
            </p>
          )}

          {phase === "error" && error && (
            <div className="mt-5 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">We couldn&apos;t make this video</p>
              <p className="mt-1 text-foreground/90">{error}</p>
            </div>
          )}

          {phase === "done" && result && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => void downloadVideo(result.path).catch(() => toast.error("Download failed."))}>
                <Download /> Download
              </Button>
              <Button variant="outline" onClick={generate}>
                <RotateCcw /> Make another version
              </Button>
              <Button asChild variant="ghost">
                <Link to="/library">See all my films</Link>
              </Button>
              <p className="w-full text-xs text-muted-foreground">Saved to your account.</p>
              <div className="w-full rounded-md border border-border bg-card p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Music className="size-4 text-primary" /> Add background music
                </p>
                <div className="flex flex-wrap gap-2">
                  {MUSIC_TRACKS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={track === m.id}
                      onClick={() => {
                        setTrack(m.id);
                        void new Audio(m.src).play().catch(() => {});
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        track === m.id ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <Button size="sm" className="mt-3" disabled={scoring} onClick={() => void downloadWithMusic()}>
                  {scoring ? <Loader2 className="animate-spin" /> : <Download />}
                  {scoring ? "Mixing music…" : "Download with music"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PhotoSlot({
  label,
  slot,
  disabled,
  showCaption,
  removable,
  onFile,
  onClear,
  onRemove,
  onCaption,
}: {
  label: string;
  slot: Slot;
  disabled: boolean;
  showCaption: boolean;
  removable: boolean;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
  onRemove: () => void;
  onCaption: (v: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label={`${label} photo`}
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-dashed border-input bg-background/40 transition-colors hover:border-primary",
            dragging && "border-primary bg-accent",
            slot.photo && "border-solid",
          )}
          aria-label={slot.photo ? `Replace ${label}` : `Choose ${label}`}
        >
          {slot.photo ? (
            <img src={slot.photo.previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5 text-primary" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {slot.photo ? `${slot.photo.width} × ${slot.photo.height}` : "Choose or drop a photo"}
          </p>
        </div>
        {slot.photo && !removable && (
          <Button variant="ghost" size="icon" aria-label={`Clear ${label}`} disabled={disabled} onClick={onClear}>
            <X />
          </Button>
        )}
        {removable && (
          <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} disabled={disabled} onClick={onRemove}>
            <X />
          </Button>
        )}
      </div>
      {showCaption && (
        <Input
          value={slot.caption}
          onChange={(e) => onCaption(e.target.value)}
          maxLength={MAX_CAPTION_LENGTH}
          disabled={disabled}
          placeholder="What happens in this scene? (optional)"
          className="mt-2 h-9 bg-background/40 text-sm"
        />
      )}
    </div>
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
            o.value === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
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
