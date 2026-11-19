import { createServerFn } from "@tanstack/react-start";
import { generateSpeech, GatewayError } from "@lovable.dev/ai-gateway";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MOVIE_MAX_SECONDS, VOICES, movieSchema, voiceoverSchema } from "./finishing";

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const generateVoiceover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => voiceoverSchema.parse(input))
  .handler(async ({ data }) => {
    const voice = VOICES.find((v) => v.id === data.voice)!;
    try {
      const res = await generateSpeech({
        model: "google/gemini-3.1-flash-tts-preview",
        contents: [{ role: "user", parts: [{ text: `${voice.style}: ${data.script}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.id } } },
        },
      });
      const blob = await res.blob();
      return { ok: true as const, audio: bytesToBase64(new Uint8Array(await blob.arrayBuffer())), mime: res.contentType };
    } catch (e) {
      console.error("Voiceover failed", e);
      const msg = e instanceof GatewayError && e.httpStatus === 429
        ? "Too many voiceovers right now. Try again in a minute."
        : "The voiceover couldn't be made. Try again.";
      return { ok: false as const, error: msg };
    }
  });

export const saveMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => movieSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: parts, error } = await context.supabase.from("videos")
      .select("id, duration, prompt, aspect_ratio, status").in("id", data.ids);
    if (error || !parts || parts.length !== data.ids.length || parts.some((p) => p.status !== "ready")) {
      throw new Error("Every scene must be a finished film in your account.");
    }
    const duration = parts.reduce((s, p) => s + p.duration, 0);
    if (duration > MOVIE_MAX_SECONDS + 1) throw new Error("Mini-movies can be at most 60 seconds.");
    const first = parts.find((p) => p.id === data.ids[0])!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = crypto.randomUUID();
    const path = `${context.userId}/${id}.mp4`;
    const { error: up } = await supabaseAdmin.storage.from("videos")
      .upload(path, base64ToBytes(data.data), { contentType: "video/mp4" });
    if (up) throw new Error("Could not save your mini-movie.");
    const { error: ins } = await supabaseAdmin.from("videos").insert({
      id, user_id: context.userId, job_id: `movie-${id}`, mode: "movie",
      prompt: `Mini-movie · ${parts.length} scenes`, duration: Math.round(duration),
      aspect_ratio: first.aspect_ratio, status: "ready", storage_path: path,
    });
    if (ins) {
      await supabaseAdmin.storage.from("videos").remove([path]);
      throw new Error("Could not save your mini-movie.");
    }
    return { path };
  });
