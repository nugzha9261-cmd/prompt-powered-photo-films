import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Clapperboard, Download, ImagePlus, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";

import { AppHeader, StepLabel } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { creditsKey, openPaywall } from "@/hooks/use-credits";
import { OUT_OF_CREDITS } from "@/lib/credits";
import { IMAGE_SHAPES, IMAGE_STYLES, IMAGES_PER_RUN, MAX_IMAGE_PROMPT, STUDIO_HANDOFF_KEY, type ImageShape } from "@/lib/image-lab";
import { generateImages } from "@/lib/image.functions";
import { preparePhoto, type Photo } from "@/lib/photo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/images")({
  head: () => ({
    meta: [
      { title: "Image Lab — CineFlow AI" },
      { name: "description", content: "Create AI images from text or remix your own photo, then turn them into videos." },
      { property: "og:title", content: "Image Lab — CineFlow AI" },
      { property: "og:description", content: "Text-to-image and photo remix, four images per credit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImageLab,
});

const IDEAS = [
  "A laughing baby in a tiny astronaut suit floating among stars",
  "A golden retriever puppy and a kitten napping in a sunny meadow",
  "A baby riding a friendly baby elephant through a jungle",
];

function ImageLab() {
  const run = useServerFn(generateImages);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [shape, setShape] = useState<ImageShape>("portrait");
  const [style, setStyle] = useState<string>("photo");
  const [source, setSource] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = async (from: Photo | null = source) => {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true); setError(null);
    try {
      const r = await run({ data: { prompt, shape, style, ...(from ? { source: from.base64 } : {}) } });
      void queryClient.invalidateQueries({ queryKey: creditsKey });
      if (!r.ok) {
        setError(r.error);
        if ("code" in r && r.code === OUT_OF_CREDITS) openPaywall();
        return;
      }
      setImages(r.images.map((b) => `data:image/jpeg;base64,${b}`));
    } catch {
      setError("The images couldn't be made. Please try again.");
    } finally { setBusy(false); }
  };

  const vary = async (dataUrl: string) => {
    const photo = await preparePhoto(new File([await (await fetch(dataUrl)).blob()], "still.jpg", { type: "image/jpeg" }));
    setSource(photo);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void create(photo);
  };

  const toStudio = (dataUrl: string) => {
    sessionStorage.setItem(STUDIO_HANDOFF_KEY, dataUrl);
    void navigate({ to: "/studio" });
  };

  const download = (dataUrl: string, i: number) => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `cineflow-image-${i + 1}.jpg`; a.click();
  };

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-6 sm:pb-20 sm:pt-12">
        <h1 className="font-display text-4xl sm:text-6xl">Image Lab<em className="text-primary">.</em></h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
          Describe a scene or remix your own photo. Every run makes {IMAGES_PER_RUN} images for 1 credit — pick one and bring it to life.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <StepLabel n={1}>Start from a photo (optional)</StepLabel>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Photo to remix"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                try { setSource(await preparePhoto(f)); } catch (err) { toast.error(err instanceof Error ? err.message : "That photo could not be used."); }
              }} />
            {source ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-card p-2.5">
                <img src={source.previewUrl} alt="Photo to remix" className="size-16 shrink-0 rounded-sm object-cover" />
                <p className="min-w-0 flex-1 text-sm">Remixing this photo</p>
                <Button variant="ghost" size="icon" aria-label="Remove photo" disabled={busy} onClick={() => setSource(null)}><X /></Button>
              </div>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus />Upload a photo to remix</Button>
            )}
          </div>

          <div>
            <StepLabel n={2}>{source ? "How should it change?" : "Describe your image"}</StepLabel>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={MAX_IMAGE_PROMPT} rows={3} disabled={busy}
              placeholder={source ? "Turn us into cartoon characters on a beach" : "A baby panda eating ice cream in Paris"} className="bg-card" />
            {!source && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {IDEAS.map((idea) => <button key={idea} type="button" disabled={busy} onClick={() => setPrompt(idea)}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground">{idea.slice(0, 32)}…</button>)}
            </div>}
          </div>

          <div>
            <StepLabel n={3}>Style</StepLabel>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {IMAGE_STYLES.map((s) => <button key={s.id} type="button" disabled={busy} aria-pressed={style === s.id} onClick={() => setStyle(s.id)}
                className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", style === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{s.label}</button>)}
            </div>
          </div>

          <div>
            <StepLabel n={4}>Shape</StepLabel>
            <div className="inline-flex rounded-md border border-border bg-card p-1">
              {(Object.keys(IMAGE_SHAPES) as ImageShape[]).map((k) => <button key={k} type="button" disabled={busy} aria-pressed={shape === k} onClick={() => setShape(k)}
                className={cn("rounded-sm px-3.5 py-1.5 text-sm", shape === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{IMAGE_SHAPES[k].label}</button>)}
            </div>
          </div>

          <Button size="lg" className="h-12 w-full text-base font-semibold sm:w-auto" disabled={busy || prompt.trim().length < 3} onClick={() => void create()}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Creating 4 images…" : `Create ${IMAGES_PER_RUN} images · 1 credit`}
          </Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        {(busy || images.length > 0) && (
          <section aria-live="polite" className="mt-8 grid grid-cols-2 gap-3">
            {busy ? Array.from({ length: IMAGES_PER_RUN }, (_, i) => (
              <div key={i} className={cn("animate-pulse rounded-md bg-muted", shape === "portrait" ? "aspect-[2/3]" : shape === "landscape" ? "aspect-[3/2]" : "aspect-square")} />
            )) : images.map((src, i) => (
              <figure key={i} className="overflow-hidden rounded-md border border-border bg-card">
                <img src={src} alt={`Generated image ${i + 1}`} className="w-full" />
                <figcaption className="grid grid-cols-3 gap-1 p-1.5">
                  <Button size="sm" className="col-span-3" onClick={() => toStudio(src)}><Clapperboard />Make video</Button>
                  <Button size="sm" variant="outline" className="col-span-2" onClick={() => void vary(src)}><Wand2 />Vary</Button>
                  <Button size="sm" variant="ghost" aria-label="Download" onClick={() => download(src, i)}><Download /></Button>
                </figcaption>
              </figure>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
