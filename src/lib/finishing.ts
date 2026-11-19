import { z } from "zod";

/** Export shapes for social platforms (720p keeps browser processing fast). */
export const EXPORT_FORMATS = {
  original: { label: "Original", width: 0, height: 0 },
  vertical: { label: "TikTok / Reels 9:16", width: 720, height: 1280 },
  wide: { label: "YouTube 16:9", width: 1280, height: 720 },
  square: { label: "Square 1:1", width: 720, height: 720 },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

export const VOICES = [
  { id: "Charon", label: "Deep narrator", style: "Read in a deep, warm cinematic narrator voice" },
  { id: "Kore", label: "Soft & friendly", style: "Read in a soft, friendly, conversational voice" },
  { id: "Fenrir", label: "Movie trailer", style: "Read like an intense, dramatic movie trailer voice" },
  { id: "Aoede", label: "Bright & upbeat", style: "Read in a bright, upbeat, energetic voice" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];
export const MAX_VOICE_CHARS = 600;

export const voiceoverSchema = z.object({
  script: z.string().trim().min(2, "Write something to say.").max(MAX_VOICE_CHARS, `Keep it under ${MAX_VOICE_CHARS} characters.`),
  voice: z.enum(VOICES.map((v) => v.id) as [VoiceId, ...VoiceId[]]),
});

export const MOVIE_MIN_SCENES = 2;
export const MOVIE_MAX_SCENES = 6;
export const MOVIE_MAX_SECONDS = 60;
const MAX_MOVIE_BASE64 = 90 * 1024 * 1024;

export const movieSchema = z.object({
  ids: z.array(z.string().uuid()).min(MOVIE_MIN_SCENES).max(MOVIE_MAX_SCENES)
    .refine((ids) => new Set(ids).size === ids.length, "Each film can be used once."),
  data: z.string().min(100).max(MAX_MOVIE_BASE64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

/** Total length check for a mini-movie selection. */
export function movieLengthOk(durations: number[]) {
  const total = durations.reduce((a, b) => a + b, 0);
  return durations.length >= MOVIE_MIN_SCENES && durations.length <= MOVIE_MAX_SCENES && total <= MOVIE_MAX_SECONDS;
}

/** Free-plan exports carry the "Lumière" corner mark; paid plans export clean. */
export function needsWatermark(hasPaidPlan: boolean) {
  return !hasPaidPlan;
}
