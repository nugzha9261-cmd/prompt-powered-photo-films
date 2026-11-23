import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Mic, Music, Play, Share2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EXPORT_FORMATS, MAX_VOICE_CHARS, VOICES, needsWatermark, type ExportFormat, type VoiceId } from "@/lib/finishing";
import { generateVoiceover } from "@/lib/finishing.functions";
import { MUSIC_TRACKS } from "@/lib/music";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";

function b64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Music, voiceover, social shapes and the free-plan mark for a finished film. */
export function FinishPanel({ videoUrl, seconds, name = "cineflow" }: { videoUrl: string; seconds: number; name?: string }) {
  const subscription = useSubscription();
  const speak = useServerFn(generateVoiceover);
  const [track, setTrack] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState<VoiceId>("Charon");
  const [voiceBlob, setVoiceBlob] = useState<{ blob: Blob; url: string; key: string } | null>(null);
  const [voicing, setVoicing] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("original");
  const [working, setWorking] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; url: string } | null>(null);
  const watermark = needsWatermark(subscription.data?.premium ?? false);
  const voiceKey = `${voice}|${script.trim()}`;

  const makeVoice = async () => {
    setVoicing(true);
    try {
      const r = await speak({ data: { script, voice } });
      if (!r.ok) return void toast.error(r.error);
      const blob = b64ToBlob(r.audio, r.mime);
      const url = URL.createObjectURL(blob);
      setVoiceBlob({ blob, url, key: voiceKey });
      setReady(null);
      void new Audio(url).play().catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voiceover failed.");
    } finally {
      setVoicing(false);
    }
  };

  const build = async () => {
    setWorking(true);
    setReady(null);
    try {
      const verified = await subscription.refetch();
      const includeWatermark = needsWatermark(verified.data?.premium ?? false);
      const t = MUSIC_TRACKS.find((m) => m.id === track);
      const [video, music, mark] = await Promise.all([
        fetch(videoUrl).then((r) => r.blob()),
        t ? fetch(t.src).then((r) => r.blob()) : undefined,
        includeWatermark ? fetch("/watermark.png").then((r) => r.blob()) : undefined,
      ]);
      const size = EXPORT_FORMATS[format];
      const { createVideoProcessor } = await import("@/lib/video-processing");
      const p = await createVideoProcessor();
      try {
        const blob = await p.finish(video, seconds, {
          music,
          voice: voiceBlob && voiceBlob.key === voiceKey ? voiceBlob.blob : undefined,
          watermark: mark,
          width: size.width || undefined,
          height: size.height || undefined,
        });
        setReady({ blob, url: URL.createObjectURL(blob) });
      } finally {
        p.close();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't finish the video.");
    } finally {
      setWorking(false);
    }
  };

  const deliver = async () => {
    if (!ready) return;
    const filename = `${name}-${format}.mp4`;
    const file = new File([ready.blob], filename, { type: "video/mp4" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Made with CineFlow AI" });
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="w-full space-y-4 rounded-md border border-border bg-card p-4">
      <p className="font-display text-xl">Finishing touches</p>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Music className="size-4 text-primary" /> Music</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={track === null} onClick={() => { setTrack(null); setReady(null); }}>None</Chip>
          {MUSIC_TRACKS.map((m) => (
            <Chip key={m.id} active={track === m.id} onClick={() => { setTrack(m.id); setReady(null); void new Audio(m.src).play().catch(() => {}); }}>
              {m.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Mic className="size-4 text-primary" /> Voiceover</p>
        <Textarea
          value={script}
          onChange={(e) => { setScript(e.target.value); setReady(null); }}
          maxLength={MAX_VOICE_CHARS}
          rows={2}
          placeholder="Type narration or a line of dialogue (optional)"
          className="resize-none bg-background/40 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {VOICES.map((v) => (
            <Chip key={v.id} active={voice === v.id} onClick={() => { setVoice(v.id); setReady(null); }}>{v.label}</Chip>
          ))}
          <Button size="sm" variant="outline" disabled={voicing || script.trim().length < 2} onClick={() => void makeVoice()}>
            {voicing ? <Loader2 className="animate-spin" /> : <Play />}
            {voiceBlob?.key === voiceKey ? "Hear again" : "Make voice"}
          </Button>
        </div>
        {voiceBlob && voiceBlob.key !== voiceKey && script.trim() && (
          <p className="mt-1 text-xs text-muted-foreground">Tap "Make voice" to update the voiceover.</p>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Share2 className="size-4 text-primary" /> Shape for</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((f) => (
            <Chip key={f} active={format === f} onClick={() => { setFormat(f); setReady(null); }}>{EXPORT_FORMATS[f].label}</Chip>
          ))}
        </div>
      </div>

      {ready ? (
        <div className="space-y-3">
          <video src={ready.url} controls playsInline className="max-h-80 w-full rounded-sm bg-muted object-contain" />
          <Button onClick={() => void deliver()}><Download /> Save / share</Button>
        </div>
      ) : (
        <Button disabled={working} onClick={() => void build()}>
          {working ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {working ? "Finishing… keep this page open" : "Create final video"}
        </Button>
      )}
      {watermark && (
          <p className="text-xs text-muted-foreground">Exports include a small "CineFlow AI" mark in the corner.</p>
      )}
    </div>
  );
}
